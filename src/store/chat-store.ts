import { create } from 'zustand';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;   // when Julia sends an image
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  isReady: boolean;
  isSending: boolean;
  isTyping: boolean;
  error: string | null;

  init: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  clearError: () => void;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isReady: false,
  isSending: false,
  isTyping: false,
  error: null,

  clearError: () => set({ error: null }),

  // ── init: just ping the server, no DB ────────────────────────────────────
  init: async () => {
    if (get().isReady) return;
    try {
      const res = await fetch('/api/session/init', { method: 'POST' });
      if (!res.ok) throw new Error('Servidor indisponível');
      set({ isReady: true, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Erro ao conectar com o servidor' });
    }
  },

  // ── sendMessage ──────────────────────────────────────────────────────────
  sendMessage: async (content: string) => {
    const state = get();
    if (state.isSending) return;

    const trimmed = content.trim();
    if (!trimmed) return;

    // Add user message immediately
    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      isSending: true,
      isTyping: true,
      error: null,
    }));

    try {
      // Build history EXCLUDING the user message we just added
      const currentMessages = get().messages;
      const historyToSend = currentMessages
        .slice(0, -1)
        .map((m) => ({
          role: m.role,
          // For history, if message has imageUrl, represent it as text so backend knows
          content: m.imageUrl ? m.imageUrl : m.content,
        }));

      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: trimmed, history: historyToSend }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}`);
      }

      const newMessages: ChatMessage[] = [];

      // Text reply (may be null when image flow triggers)
      if (data.reply) {
        newMessages.push({
          id: makeId(),
          role: 'assistant',
          content: data.reply,
          timestamp: Date.now(),
        });
      }

      // Image message
      if (data.imageUrl) {
        newMessages.push({
          id: makeId(),
          role: 'assistant',
          content: '',        // no text; rendered as <img>
          imageUrl: data.imageUrl,
          timestamp: Date.now() + 1,
        });
      }

      // Follow-up message after image
      if (data.followUp) {
        newMessages.push({
          id: makeId(),
          role: 'assistant',
          content: data.followUp,
          timestamp: Date.now() + 2,
        });
      }

      set((s) => ({
        messages: [...s.messages, ...newMessages],
        isSending: false,
        isTyping: false,
        error: null,
      }));
    } catch (err) {
      // Remove the user message on error so the user can retry
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== userMsg.id),
        isSending: false,
        isTyping: false,
        error: err instanceof Error ? err.message : 'Erro ao enviar mensagem',
      }));
    }
  },
}));
