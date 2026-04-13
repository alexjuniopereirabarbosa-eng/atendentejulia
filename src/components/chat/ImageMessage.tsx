'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ImageMessageProps {
  url: string;
}

export default function ImageMessage({ url }: ImageMessageProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="mb-1 cursor-pointer" onClick={() => setExpanded(true)}>
        <Image
          src={url}
          alt="Foto da Julia"
          width={280}
          height={280}
          className="chat-image rounded-md"
          style={{ objectFit: 'cover' }}
        />
      </div>

      {/* Fullscreen modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center fade-in"
          onClick={() => setExpanded(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            onClick={() => setExpanded(false)}
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
          <Image
            src={url}
            alt="Foto da Julia"
            width={600}
            height={600}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded"
          />
        </div>
      )}
    </>
  );
}
