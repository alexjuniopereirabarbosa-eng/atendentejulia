'use client';

import { useState } from 'react';
import { useChatStore } from '@/store/chat-store';

export default function PaymentModal() {
  const showPaymentModal = useChatStore((s) => s.showPaymentModal);
  const setShowPaymentModal = useChatStore((s) => s.setShowPaymentModal);
  const conversationId = useChatStore((s) => s.conversationId);
  const refreshConversation = useChatStore((s) => s.refreshConversation);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!showPaymentModal) return null;

  const handleCreatePayment = async () => {
    if (!conversationId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Erro ao criar pagamento' }));
        throw new Error(errData.error || 'Erro ao criar pagamento');
      }

      const data = await res.json();
      
      if (data.checkoutUrl) {
        setCheckoutUrl(data.checkoutUrl);
        // Open in new tab
        window.open(data.checkoutUrl, '_blank');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    await refreshConversation();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 fade-in p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00a884] to-[#008069] px-6 py-5 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">💬</span>
          </div>
          <h2 className="text-lg font-semibold">Continue conversando com Julia</h2>
          <p className="text-white/80 text-sm mt-1">
            Libere mais 30 mensagens
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {!checkoutUrl ? (
            <>
              <div className="flex items-center justify-between mb-4 ">
                <span className="text-[#54656f] text-sm">Pacote de mensagens</span>
                <span className="text-[#111b21] font-semibold text-lg">R$ 19,90</span>
              </div>

              <ul className="text-[13px] text-[#667781] space-y-2 mb-5">
                <li className="flex items-center gap-2">
                  <span className="text-[#00a884]">✓</span> 30 respostas adicionais da Julia
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#00a884]">✓</span> Fotos exclusivas da Julia
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#00a884]">✓</span> Conversa mais íntima e personalizada
                </li>
              </ul>

              <button
                onClick={handleCreatePayment}
                disabled={isLoading}
                className="w-full bg-[#00a884] hover:bg-[#008069] text-white font-medium py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait text-[15px]"
                id="create-payment-button"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processando...
                  </span>
                ) : (
                  'Pagar com Mercado Pago'
                )}
              </button>
            </>
          ) : (
            <>
              <div className="text-center mb-4">
                <p className="text-[#54656f] text-sm mb-3">
                  O pagamento foi aberto em outra aba. Após concluir, clique abaixo para verificar.
                </p>
                <button
                  onClick={handleCheckStatus}
                  className="w-full bg-[#00a884] hover:bg-[#008069] text-white font-medium py-3 rounded-full transition-colors text-[15px]"
                  id="check-payment-button"
                >
                  Já paguei — verificar liberação
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer close */}
        <div className="border-t border-[#e9edef] px-6 py-3 text-center">
          <button
            onClick={() => {
              setShowPaymentModal(false);
              setCheckoutUrl(null);
              setError(null);
            }}
            className="text-[#667781] text-sm hover:text-[#111b21] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
