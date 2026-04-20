'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chat-store';
import TypingIndicator from './TypingIndicator';

export default function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const isTyping = useChatStore((s) => s.isTyping);
  const error = useChatStore((s) => s.error);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto wa-wallpaper px-3 sm:px-12 md:px-16 lg:px-24 py-2">

      {messages.length === 0 && !isTyping && (
        <div className="flex justify-center mt-8">
          <span className="bg-white/90 text-[#54656f] text-[12.5px] px-3 py-1 rounded-lg shadow-sm">
            HOJE
          </span>
        </div>
      )}

      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });

        // ── Image message ──────────────────────────────────────────────────
        if (msg.imageUrl) {
          return (
            <div key={msg.id} className="flex mb-1 justify-start msg-in">
              <div
                className="relative max-w-[65%] sm:max-w-[55%] rounded-lg overflow-hidden shadow-sm bg-white"
                style={{ minWidth: 80 }}
              >
                <img
                  src={msg.imageUrl}
                  alt="Foto da Julia"
                  className="w-full h-auto block rounded-t-lg"
                  style={{ maxHeight: 400, objectFit: 'cover' }}
                  loading="lazy"
                />
                <div className="flex items-center justify-end gap-1 px-2 py-1">
                  <span className="text-[11px] text-[#667781] leading-none select-none">
                    {time}
                  </span>
                </div>
              </div>
            </div>
          );
        }

        // ── Text message ───────────────────────────────────────────────────
        return (
          <div
            key={msg.id}
            className={`flex mb-0.5 ${isUser ? 'justify-end msg-out' : 'justify-start msg-in'}`}
          >
            <div
              className={`relative max-w-[65%] sm:max-w-[60%] rounded-lg px-2.5 py-1.5 shadow-sm
                ${isUser ? 'bg-[#d9fdd3] bubble-out ml-16' : 'bg-white bubble-in mr-16'}`}
              style={{ minWidth: 80 }}
            >
              <p className="text-[14.2px] text-[#111b21] leading-[19px] whitespace-pre-wrap break-words">
                {msg.content}
              </p>
              <div className="flex items-center gap-1 justify-end mt-0.5 -mb-0.5">
                <span className="text-[11px] text-[#667781] leading-none select-none">
                  {time}
                </span>
                {isUser && (
                  <span className="check-marks leading-none select-none" style={{ fontSize: 16 }}>
                    ✓✓
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {isTyping && <TypingIndicator />}

      {error && (
        <div className="flex justify-center my-2">
          <div className="bg-red-50 border border-red-200 text-red-600 text-[12.5px] px-4 py-1.5 rounded-lg shadow-sm max-w-[85%] text-center">
            {error}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
