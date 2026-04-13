'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chat-store';
import type { Message } from '@/lib/conversation-logic';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

export default function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const isTyping = useChatStore((s) => s.isTyping);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Group messages by date
  const groupedMessages = groupByDate(messages);

  return (
    <div className="flex-1 overflow-y-auto wa-wallpaper px-3 sm:px-12 md:px-16 lg:px-24 py-2">
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date separator */}
          <div className="flex justify-center my-3">
            <span className="bg-white/90 text-[#54656f] text-[12.5px] px-3 py-1 rounded-lg shadow-sm">
              {group.label}
            </span>
          </div>

          {/* Messages */}
          {group.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      ))}

      {/* Typing indicator */}
      {isTyping && <TypingIndicator />}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}

function groupByDate(messages: Message[]) {
  const groups: { date: string; label: string; messages: Message[] }[] = [];
  let currentDate = '';

  for (const msg of messages) {
    const msgDate = new Date(msg.created_at).toLocaleDateString('pt-BR');
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      const today = new Date().toLocaleDateString('pt-BR');
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR');
      
      let label = msgDate;
      if (msgDate === today) label = 'HOJE';
      else if (msgDate === yesterday) label = 'ONTEM';
      
      groups.push({ date: msgDate, label, messages: [] });
    }
    groups[groups.length - 1].messages.push(msg);
  }

  return groups;
}
