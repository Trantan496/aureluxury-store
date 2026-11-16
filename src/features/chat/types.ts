export type ChatSenderRole = "CUSTOMER" | "BOT" | "STAFF";

export type ChatThreadChannel = "BOT" | "STAFF";

export type ChatHandlingMode = "BOT" | "WAITING_STAFF" | "STAFF";

export type ChatConversationStatus = "OPEN" | "RESOLVED";

export type ChatProductSuggestion = {
  id: string;
  slug: string;
  name: string;
  price: string | null;
  currency: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  stock?: number | null;
  sizes?: string[];
  colors?: string[];
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderRole: ChatSenderRole;
  senderName: string;
  content: string;
  createdAt: string;
  suggestions?: ChatProductSuggestion[];
  quickReplies?: string[];
};

export type ChatConversation = {
  id: string;
  participantKey: string;
  userId: number | null;
  customerName: string;
  customerEmail: string | null;
  channel: ChatThreadChannel;
  title: string;
  pinned: boolean;
  isDefault: boolean;
  hasStarted: boolean;
  botReplyCount: number;
  mode: ChatHandlingMode;
  status: ChatConversationStatus;
  unreadByStaff: number;
  unreadByCustomer: number;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  messages: ChatMessage[];
};

export type ChatConversationSummary = Omit<ChatConversation, "messages"> & {
  messageCount: number;
};

export const DEFAULT_QUICK_REPLIES = [
  "Tìm áo khoác Trench Coat",
  "Tư vấn chọn size",
  "Kiểm tra đơn hàng",
  "Chính sách đổi trả",
  "Gặp nhân viên tư vấn",
] as const;

/**
 * Sort customer threads:
 * 1. Pinned Staff threads ("Nhân viên AUREL") always stay on top.
 * 2. Bot threads follow immediately after.
 * 3. Within each group, newest updated/created threads come first.
 */
export function sortCustomerThreads<
  T extends {
    channel: ChatThreadChannel;
    pinned: boolean;
    updatedAt: string;
    createdAt: string;
  },
>(threads: readonly T[]): T[] {
  return [...threads].sort((a, b) => {
    const aPinnedStaff = a.channel === "STAFF" || a.pinned;
    const bPinnedStaff = b.channel === "STAFF" || b.pinned;
    if (aPinnedStaff !== bPinnedStaff) {
      return aPinnedStaff ? -1 : 1;
    }

    const updatedDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (updatedDiff !== 0) return updatedDiff;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
