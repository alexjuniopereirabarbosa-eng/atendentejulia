'use client';

import { useEffect } from 'react';
import { useChatStore } from '@/store/chat-store';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageList from '@/components/chat/MessageList';
import ChatInput from '@/components/chat/ChatInput';

const ASSISTANT_NAME = process.env.NEXT_PUBLIC_ASSISTANT_NAME || 'Julia';

export default function ChatPage() {
  const init = useChatStore((s) => s.init);
  const isReady = useChatStore((s) => s.isReady);
  const error = useChatStore((s) => s.error);
  const clearError = useChatStore((s) => s.clearError);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Error state (server unreachable)
  if (error && !isReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#efeae2] p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-[#111b21] font-medium mb-2">Erro ao conectar</h2>
          <p className="text-[#667781] text-sm mb-4">{error}</p>
          <button
            onClick={() => { clearError(); init(); }}
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
      <div className="flex flex-col w-full max-w-[1100px] h-full bg-[#efeae2] shadow-xl relative">
        {/* Top green bar (desktop only) */}
        <div className="hidden sm:block absolute top-0 left-0 right-0 h-[127px] bg-[#00a884] z-0" />

        {/* Chat container */}
        <div className="relative z-10 flex flex-col h-full">
          <ChatHeader name={ASSISTANT_NAME} avatarUrl="/julia/avatar.jpg" />

          <div className="flex-1 flex flex-col min-h-0">
            <MessageList />
          </div>

          <ChatInput />
        </div>
      </div>
    </div>
  );
}
