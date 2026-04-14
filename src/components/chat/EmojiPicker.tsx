'use client';

import { useEffect, useRef } from 'react';

const EMOJIS = [
  '😀','😂','🥰','😍','🤩','😎','🥳','😅','😇','🤔',
  '😢','😭','😤','😡','🤯','😱','🤗','😏','🙄','😴',
  '👍','👎','👏','🙌','🤝','🙏','✌️','🤞','💪','👋',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕',
  '🔥','⭐','✨','💥','🎉','🎊','🎈','🎁','🏆','🚀',
  '😸','🐶','🐱','🐻','🐼','🐨','🐯','🦁','🐸','🐧',
  '🍕','🍔','🌮','🍣','🍜','🍰','🎂','🍩','☕','🧃',
  '⚽','🏀','🎮','🎵','🎸','📱','💻','📚','✏️','🔑',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-1 ml-2 bg-white border border-[#e9edef] rounded-xl shadow-lg p-2 z-50"
      style={{ width: 288 }}
    >
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="text-xl p-1 rounded hover:bg-[#f0f2f5] transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
