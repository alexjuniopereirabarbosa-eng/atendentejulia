'use client';

import type { Message } from '@/lib/conversation-logic';
import ImageMessage from './ImageMessage';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';
  const isImage = message.message_type === 'image';
  
  // System messages
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-[#ffecd2] text-[#54656f] text-[12.5px] px-4 py-1.5 rounded-lg shadow-sm max-w-[85%] text-center">
          {message.content}
        </div>
      </div>
    );
  }

  const time = new Date(message.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex mb-0.5 ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'msg-out' : 'msg-in'}`}>
      <div
        className={`relative max-w-[65%] sm:max-w-[60%] rounded-lg px-2.5 py-1.5 shadow-sm
          ${isUser
            ? 'bg-[#d9fdd3] bubble-out ml-16'
            : 'bg-white bubble-in mr-16'
          }
        `}
        style={{ minWidth: 80 }}
      >
        {/* Image content */}
        {isImage && message.image_url && (
          <ImageMessage url={message.image_url} />
        )}

        {/* Text content */}
        {message.content && (
          <p className="text-[14.2px] text-[#111b21] leading-[19px] whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}

        {/* Time + check marks */}
        <div className={`flex items-center gap-1 justify-end mt-0.5 -mb-0.5 ${message.content ? '' : 'mt-1'}`}>
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
}
