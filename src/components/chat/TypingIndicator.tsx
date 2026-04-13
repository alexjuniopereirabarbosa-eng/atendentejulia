'use client';

export default function TypingIndicator() {
  return (
    <div className="flex justify-start mb-1 msg-in">
      <div className="relative bg-white rounded-lg px-3 py-2.5 shadow-sm bubble-in mr-16">
        <div className="flex items-center gap-1">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}
