import { create } from 'zustand';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatState {
  // In-memory conversation — cleared on page reload
  messages: ChatMessage[];

  // UI state
  isReady: boolean;      // true once session/init confirmed server is reachable
  isSending: boolean;
  isTyping: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  clearError: () => void;
}

// ─── Helper ────────────────────────────────────────────────────────────────

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

  // ── init ─────────────────────────────────────────────────────────────────
  // Just pings the server to confirm it's reachable. No DB, no localStorage.
  init: async () => {
    if (get().isReady) return;

    try {
      const res = await fetch('/api/session/init', { method: 'POST' });
      if (!res.ok) throw new Error('Servidor indisponível');
      set({ isReady: true, error: null });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Erro ao conectar com o servidor',
      });
    }
  },

  // ── sendMessage ──────────────────────────────────────────────────────────
  sendMessage: async (content: string) => {
    const state = get();
    if (state.isSending) return;

    const trimmed = content.trim();
    if (!trimmed) return;

    // Add user message to in-memory store immediately
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
      // Build the history array to send to the backend
      // Include all messages BEFORE the current one (backend adds current separately)
      const currentMessages = get().messages;
      const historyToSend = currentMessages
        .slice(0, -1) // all except the user message we just added
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: trimmed,
          history: historyToSend,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}`);
      }

      if (!data.reply) {
        throw new Error('Resposta vazia da IA');
      }

      // Add assistant reply to in-memory store
      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now(),
      };

      set((s) => ({
        messages: [...s.messages, assistantMsg],
        isSending: false,
        isTyping: false,
        error: null,
      }));
    } catch (err) {
      // Remove the user message on error so user can retry
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== userMsg.id),
        isSending: false,
        isTyping: false,
        error: err instanceof Error ? err.message : 'Erro ao enviar mensagem',
      }));
    }
  },
}));
