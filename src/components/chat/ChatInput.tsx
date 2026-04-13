'use client';

import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent } from 'react';
import { useChatStore } from '@/store/chat-store';
import EmojiPicker from './EmojiPicker';

export default function ChatInput() {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isSending = useChatStore((s) => s.isSending);
  const status = useChatStore((s) => s.status);

  const isBlocked = status === 'blocked_free_limit' || status === 'blocked_paid_limit';

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [text]);

  const handleSend = () => {
    if (!text.trim() || isSending || isBlocked) return;
    sendMessage(text.trim());
    setText('');
    setShowEmoji(false);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="relative shrink-0 bg-[#f0f2f5] border-t border-[#e9edef]">
      {/* Emoji picker */}
      {showEmoji && !isBlocked && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmoji(false)}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-4 py-2.5"
      >
        {/* Emoji button */}
        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          disabled={isBlocked}
          className="p-2 rounded-full hover:bg-black/5 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed self-end mb-0.5"
          aria-label="Emoji"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#54656f">
            <path d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363 1.108s-.669 1.959-5.051 1.959c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S22.82 18.423 22.82 12.228c.001-6.195-5.021-11.217-11.016-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z" />
          </svg>
        </button>

        {/* Text input */}
        <div className="flex-1 bg-white rounded-lg border border-transparent focus-within:border-transparent overflow-hidden">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isBlocked ? 'Conversa bloqueada...' : 'Mensagem'}
            disabled={isBlocked || isSending}
            rows={1}
            className="w-full px-3 py-2 text-[15px] text-[#111b21] placeholder-[#667781] bg-transparent border-none outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ maxHeight: 120 }}
            id="chat-input"
          />
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={!text.trim() || isSending || isBlocked}
          className="p-2 rounded-full hover:bg-black/5 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed self-end mb-0.5"
          aria-label="Enviar"
          id="send-button"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill={text.trim() ? '#00a884' : '#8696a0'}>
            <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
          </svg>
        </button>
      </form>

      {/* Transparency notice */}
      <div className="text-center pb-1">
        <span className="text-[10px] text-[#8696a0] select-none">
          Você está conversando com uma assistente virtual.
        </span>
      </div>
    </div>
  );
}
