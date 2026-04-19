import { create } from 'zustand';
import type { Conversation, Message } from '@/lib/conversation-logic';

interface ChatState {
  // Session
  conversationId: string | null;
  userId: string | null;
  
  // Conversation state
  status: Conversation['status'];
  freeUsed: number;
  paidRemaining: number;
  totalPaidCycles: number;
  
  // Messages
  messages: Message[];
  
  // UI
  isTyping: boolean;
  isLoading: boolean;
  isSending: boolean;
  isInitialized: boolean;
  error: string | null;
  showPaymentModal: boolean;
  
  // Actions
  setConversation: (conv: Conversation) => void;
  setMessages: (msgs: Message[]) => void;
  addMessage: (msg: Message) => void;
  setIsTyping: (val: boolean) => void;
  setIsLoading: (val: boolean) => void;
  setIsSending: (val: boolean) => void;
  setError: (err: string | null) => void;
  setShowPaymentModal: (val: boolean) => void;
  setInitialized: (val: boolean) => void;
  
  // Async actions
  initSession: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  refreshConversation: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  conversationId: null,
  userId: null,
  status: 'active',
  freeUsed: 0,
  paidRemaining: 0,
  totalPaidCycles: 0,
  messages: [],
  isTyping: false,
  isLoading: false,
  isSending: false,
  isInitialized: false,
  error: null,
  showPaymentModal: false,

  // Setters
  setConversation: (conv) =>
    set({
      conversationId: conv.id,
      userId: conv.user_id,
      status: conv.status,
      freeUsed: conv.free_used,
      paidRemaining: conv.paid_remaining,
      totalPaidCycles: conv.total_paid_cycles,
    }),

  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setIsTyping: (val) => set({ isTyping: val }),
  setIsLoading: (val) => set({ isLoading: val }),
  setIsSending: (val) => set({ isSending: val }),
  setError: (err) => set({ error: err }),
  setShowPaymentModal: (val) => set({ showPaymentModal: val }),
  setInitialized: (val) => set({ isInitialized: val }),

  // Init session
  initSession: async () => {
    const state = get();
    if (state.isLoading || state.isInitialized) return;

    set({ isLoading: true, error: null });

    try {
      // Import fingerprint dynamically (client-side only)
      const { getBrowserFingerprint } = await import('@/lib/fingerprint');
      const fingerprint = await getBrowserFingerprint();

      // Recuperar conversationId salvo localmente
      const savedConversationId =
        typeof window !== 'undefined'
          ? localStorage.getItem('julia_conversation_id')
          : null;

      const res = await fetch('/api/session/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint,
          conversationId: savedConversationId || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Erro ao iniciar sessão');
      }

      const data = await res.json();

      // Persistir o conversationId para recuperar na próxima visita
      if (typeof window !== 'undefined') {
        localStorage.setItem('julia_conversation_id', data.conversation.id);
      }

      set({
        conversationId: data.conversation.id,
        userId: data.conversation.user_id,
        status: data.conversation.status,
        freeUsed: data.conversation.free_used,
        paidRemaining: data.conversation.paid_remaining,
        totalPaidCycles: data.conversation.total_paid_cycles,
        messages: data.messages || [],
        isInitialized: true,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Send message
  sendMessage: async (content: string) => {
    const state = get();
    if (!state.conversationId || state.isSending) return;

    const trimmed = content.trim();
    if (!trimmed) return;

    set({ isSending: true, error: null });

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: state.conversationId,
      sender: 'user',
      content: trimmed,
      message_type: 'text',
      image_url: null,
      created_at: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, tempUserMsg] }));

    // Show typing indicator
    set({ isTyping: true });

    try {
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: state.conversationId,
          content: trimmed,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        
        if (errData.error === 'LIMIT_REACHED') {
          // Força o bloqueio no frontend
          set({ status: 'blocked_free_limit' });
          throw new Error('LIMIT_REACHED');
        }

        throw new Error(errData.error || 'Erro ao enviar mensagem');
      }

      const data = await res.json();

      // Replace temp message with real ones and add assistant response(s)
      set((s) => {
        const filtered = s.messages.filter((m) => m.id !== tempUserMsg.id);
        const newMsgs = [data.userMessage, data.assistantMessage];
        if (data.imageMessage) newMsgs.push(data.imageMessage);
        if (data.followupMessage) newMsgs.push(data.followupMessage);
        return {
          messages: [...filtered, ...newMsgs],
          status: data.conversation.status,
          freeUsed: data.conversation.free_used,
          paidRemaining: data.conversation.paid_remaining,
          totalPaidCycles: data.conversation.total_paid_cycles,
        };
      });

      // Check if blocked after this response
      if (
        data.conversation.status === 'blocked_free_limit' ||
        data.conversation.status === 'blocked_paid_limit'
      ) {
        set({ showPaymentModal: true });
      }
    } catch (err) {
      const isLimitReached = err instanceof Error && err.message === 'LIMIT_REACHED';
      
      // Remove temp message on error
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== tempUserMsg.id),
        // Se for LIMIT_REACHED, não joga erro genérico, só o bloqueio visual atua
        error: isLimitReached ? null : (err instanceof Error ? err.message : 'Erro ao enviar'),
      }));
    } finally {
      set({ isSending: false, isTyping: false });
    }
  },

  // Refresh conversation state
  refreshConversation: async () => {
    const state = get();
    if (!state.conversationId) return;

    try {
      const res = await fetch(`/api/conversation?id=${state.conversationId}`);
      if (res.ok) {
        const data = await res.json();
        set({
          status: data.conversation.status,
          freeUsed: data.conversation.free_used,
          paidRemaining: data.conversation.paid_remaining,
          totalPaidCycles: data.conversation.total_paid_cycles,
          messages: data.messages || [],
        });

        if (
          data.conversation.status !== 'blocked_free_limit' &&
          data.conversation.status !== 'blocked_paid_limit'
        ) {
          set({ showPaymentModal: false });
        }
      }
    } catch {
      // Silent fail on refresh
    }
  },
}));
