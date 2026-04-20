export interface Conversation {
  id: string;
  status: 'active' | 'active_free' | 'paid' | 'active_paid' | 'blocked_free_limit' | 'blocked_paid_limit';
  free_used: number;
  paid_remaining: number;
  created_at: string;
  updated_at: string;
  // colunas opcionais (podem nao existir no banco atual)
  user_id?: string;
  fingerprint?: string | null;
  total_paid_cycles?: number;
  current_cycle_images_sent?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string | null;
  message_type: 'text' | 'emoji' | 'image' | 'system';
  image_url?: string | null;
  created_at: string;
}

const FREE_LIMIT = 15;
const PAID_LIMIT = 30;
const MAX_IMAGES_PER_CYCLE = 2;

export function canRespond(conversation: Conversation): boolean {
  if (conversation.status === 'blocked_free_limit' || conversation.status === 'blocked_paid_limit') {
    return false;
  }
  if (conversation.status === 'active' || conversation.status === 'active_free') {
    return conversation.free_used < FREE_LIMIT;
  }
  if (conversation.status === 'paid' || conversation.status === 'active_paid') {
    return (conversation.paid_remaining || 0) > 0;
  }
  return false;
}

export function getUpdatedCounters(conversation: Conversation): {
  free_used: number;
  paid_remaining: number;
  status: Conversation['status'];
} {
  let { free_used, paid_remaining, status } = conversation;

  if (status === 'active' || status === 'active_free') {
    free_used += 1;
    if (free_used >= FREE_LIMIT) status = 'blocked_free_limit';
  } else if ((status === 'paid' || status === 'active_paid') && (paid_remaining || 0) > 0) {
    paid_remaining = (paid_remaining || 0) - 1;
    if (paid_remaining <= 0) status = 'blocked_paid_limit';
  }

  return { free_used, paid_remaining, status };
}

export type Stage = 'inicio' | 'nome' | 'conexao' | 'curiosidade' | 'produto' | 'fechamento';

/**
 * Derive the current conversation stage from the number of assistant
 * messages already sent (counted from the message history, not free_used).
 * This is the single source of truth — no extra DB column needed.
 *
 *  0 sent → inicio      (Julia greets, asks name)
 *  1 sent → nome        (Julia received name, asks about the day)
 *  2-3    → conexao     (Julia builds genuine connection)
 *  4-6    → curiosidade (Julia sparks curiosity about the product)
 *  7-12   → produto     (Julia presents the product naturally)
 *  13+    → fechamento  (Julia drives to action / purchase)
 */
export function getStageFromAssistantCount(assistantCount: number): Stage {
  if (assistantCount === 0) return 'inicio';
  if (assistantCount === 1) return 'nome';
  if (assistantCount <= 3) return 'conexao';
  if (assistantCount <= 6) return 'curiosidade';
  if (assistantCount <= 12) return 'produto';
  return 'fechamento';
}

/** Legacy phase helper kept for backward compat with prompts.ts */
export function getConversationPhase(conversation: Conversation): string {
  if (conversation.status === 'paid' || conversation.status === 'active_paid') return 'paid';
  const used = conversation.free_used || 0;
  if (used <= 3) return 'welcome';
  if (used <= 7) return 'connection';
  if (used <= 15) return 'retention';
  return 'paid';
}

export function isBlocked(conversation: Conversation): boolean {
  return (
    conversation.status === 'blocked_free_limit' ||
    conversation.status === 'blocked_paid_limit'
  );
}

export function isLastPaidMessage(conversation: Conversation): boolean {
  return (conversation.status === 'paid' || conversation.status === 'active_paid') &&
    (conversation.paid_remaining || 0) === 1;
}

export { FREE_LIMIT, PAID_LIMIT, MAX_IMAGES_PER_CYCLE };
