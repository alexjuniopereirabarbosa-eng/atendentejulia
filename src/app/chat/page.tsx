'use client';

import { useEffect } from 'react';
import { useChatStore } from '@/store/chat-store';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageList from '@/components/chat/MessageList';
import ChatInput from '@/components/chat/ChatInput';
import LockedOverlay from '@/components/chat/LockedOverlay';
import PaymentModal from '@/components/chat/PaymentModal';

const ASSISTANT_NAME = process.env.NEXT_PUBLIC_ASSISTANT_NAME || 'Julia';

export default function ChatPage() {
  const initSession = useChatStore((s) => s.initSession);
  const isLoading = useChatStore((s) => s.isLoading);
  const isInitialized = useChatStore((s) => s.isInitialized);
  const error = useChatStore((s) => s.error);
  const refreshConversation = useChatStore((s) => s.refreshConversation);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Poll for payment status changes (checks every 5s when blocked)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshConversation();
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshConversation]);

  // Loading state
  if (!isInitialized && isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#efeae2]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#667781] text-sm">Conectando com Julia...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#efeae2] p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-[#111b21] font-medium mb-2">Erro ao conectar</h2>
          <p className="text-[#667781] text-sm mb-4">{error}</p>
          <button
            onClick={() => initSession()}
            className="bg-[#00a884] text-white px-6 py-2 rounded-full text-sm hover:bg-[#008069] transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex justify-center bg-[#d1d7db]">
      {/* WhatsApp outer container */}
      <div className="flex flex-col w-full max-w-[1100px] h-full bg-[#efeae2] shadow-xl relative">
        {/* Top green bar (desktop only) */}
        <div className="hidden sm:block absolute top-0 left-0 right-0 h-[127px] bg-[#00a884] z-0" />

        {/* Chat container */}
        <div className="relative z-10 flex flex-col h-full sm:mx-0 sm:my-0">
          {/* Header */}
          <ChatHeader
            name={ASSISTANT_NAME}
            avatarUrl="/julia/avatar.jpg"
          />

          {/* Messages */}
          <div className="relative flex-1 flex flex-col min-h-0">
            <MessageList />
            <LockedOverlay />
          </div>

          {/* Input */}
          <ChatInput />
        </div>
      </div>

      {/* Payment modal */}
      <PaymentModal />
    </div>
  );
}
