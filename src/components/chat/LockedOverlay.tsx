'use client';

import { useChatStore } from '@/store/chat-store';

export default function LockedOverlay() {
  const status = useChatStore((s) => s.status);
  const setShowPaymentModal = useChatStore((s) => s.setShowPaymentModal);

  const isBlocked = status === 'blocked_free_limit' || status === 'blocked_paid_limit';

  if (!isBlocked) return null;

  const message =
    status === 'blocked_free_limit'
      ? 'Nossa conversa gratuita terminou por agora. Para continuar falando comigo, libere mais mensagens por R\u00A019,90.'
      : 'Que bom que voltou, meu amor! Para continuar nossa conversa, libere mais mensagens por R\u00A019,90.';

  return (
    <div className="absolute bottom-0 left-0 right-0 lock-gradient fade-in z-30 pointer-events-auto"
      style={{ height: 200 }}
    >
      <div className="flex flex-col items-center justify-end h-full pb-4 px-6 gap-3">
        {/* Lock icon */}
        <div className="w-12 h-12 bg-[#f0f2f5] rounded-full flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#667781">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        </div>

        {/* Message */}
        <p className="text-[13px] text-[#54656f] text-center max-w-sm leading-relaxed">
          {message}
        </p>

        {/* Payment button */}
        <button
          onClick={() => setShowPaymentModal(true)}
          className="pulse-btn bg-[#00a884] hover:bg-[#008069] text-white font-medium text-[14px] px-6 py-2.5 rounded-full shadow-lg transition-colors"
          id="payment-button"
        >
          💬 Liberar conversa por R$ 19,90
        </button>
      </div>
    </div>
  );
}
