export interface Conversation {
  id: string;
  user_id: string;
  fingerprint: string | null;
  status: 'active' | 'paid' | 'blocked_free_limit' | 'blocked_paid_limit';
  free_used: number;
  paid_remaining: number;
  total_paid_cycles: number;
  current_cycle_images_sent: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string | null;
  message_type: 'text' | 'emoji' | 'image' | 'system';
  image_url: string | null;
  created_at: string;
}

const FREE_LIMIT = 15;
const PAID_LIMIT = 30;
const MAX_IMAGES_PER_CYCLE = 2;

/**
 * Check if the user can send a message (i.e., assistant can respond)
 */
export function canRespond(conversation: Conversation): boolean {
  if (conversation.status === 'blocked_free_limit' || conversation.status === 'blocked_paid_limit') {
    return false;
  }

  // Active state: check if free limit not reached
  if (conversation.status === 'active') {
    return conversation.free_used < FREE_LIMIT;
  }

  // Paid state: check if paid remaining > 0
  if (conversation.status === 'paid') {
    return conversation.paid_remaining > 0;
  }

  return false;
}

/**
 * Calculate updated counters after assistant responds
 */
export function getUpdatedCounters(conversation: Conversation): {
  free_used: number;
  paid_remaining: number;
  status: Conversation['status'];
} {
  let { free_used, paid_remaining, status } = conversation;

  if (status === 'active') {
    // Using free messages
    free_used += 1;
    if (free_used >= FREE_LIMIT) {
      status = 'blocked_free_limit';
    }
  } else if (status === 'paid' && paid_remaining > 0) {
    // Using paid messages
    paid_remaining -= 1;
    if (paid_remaining <= 0) {
      status = 'blocked_paid_limit';
    }
  }

  return { free_used, paid_remaining, status };
}

/**
 * Get the current phase of conversation for prompt context
 */
export function getConversationPhase(conversation: Conversation): string {
  const totalAssistantMessages = conversation.free_used + 
    (conversation.total_paid_cycles * PAID_LIMIT - conversation.paid_remaining);

  if (conversation.status === 'paid') {
    return 'paid';
  }

  if (totalAssistantMessages <= 5) return 'welcome'; // msgs 1-5
  if (totalAssistantMessages <= 10) return 'connection'; // msgs 6-10
  if (totalAssistantMessages <= 15) return 'retention'; // msgs 11-15
  return 'paid';
}

/**
 * Check if the assistant should send an image in current response
 */
export function canSendImage(conversation: Conversation): boolean {
  return (
    conversation.status === 'paid' &&
    conversation.paid_remaining > 0 &&
    conversation.current_cycle_images_sent < MAX_IMAGES_PER_CYCLE
  );
}

/**
 * Check if the conversation is blocked
 */
export function isBlocked(conversation: Conversation): boolean {
  return (
    conversation.status === 'blocked_free_limit' ||
    conversation.status === 'blocked_paid_limit'
  );
}

/**
 * Check if this is the last message of the paid cycle
 */
export function isLastPaidMessage(conversation: Conversation): boolean {
  return conversation.status === 'paid' && conversation.paid_remaining === 1;
}

export { FREE_LIMIT, PAID_LIMIT, MAX_IMAGES_PER_CYCLE };
