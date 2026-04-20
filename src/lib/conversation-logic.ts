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

export function getConversationPhase(conversation: Conversation): string {
  const totalPaidCycles = conversation.total_paid_cycles || 0;
  const paidRemaining = conversation.paid_remaining || 0;
  const totalAssistantMessages =
    conversation.free_used + (totalPaidCycles * PAID_LIMIT - paidRemaining);

  if (conversation.status === 'paid' || conversation.status === 'active_paid') return 'paid';
  if (totalAssistantMessages <= 3) return 'welcome';   // msgs 1-3: conexão/nome/dia
  if (totalAssistantMessages <= 7) return 'connection'; // msgs 4-7: quebra de padrão/curiosidade
  if (totalAssistantMessages <= 15) return 'retention'; // msgs 8-15: apresentação do produto
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
