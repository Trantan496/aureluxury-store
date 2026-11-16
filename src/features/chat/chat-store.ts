import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_QUICK_REPLIES,
  sortCustomerThreads,
  type ChatConversation,
  type ChatConversationStatus,
  type ChatConversationSummary,
  type ChatHandlingMode,
  type ChatMessage,
  type ChatProductSuggestion,
  type ChatSenderRole,
  type ChatThreadChannel,
} from "./types.ts";

type StoreData = {
  conversations: ChatConversation[];
};

const DEFAULT_STORE_FILE = path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "aurel-chat-sessions.json");
const MAX_MESSAGES_PER_CONVERSATION = 250;
const MAX_MESSAGE_LENGTH = 1500;

export function sanitizeChatText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function defaultTitleForChannel(channel: ChatThreadChannel, isDefault: boolean): string {
  if (channel === "STAFF") {
    return isDefault ? "Nhân viên AUREL" : "Đoạn chat mới · Nhân viên";
  }
  return isDefault ? "AUREL Concierge Bot" : "Đoạn chat mới · Bot";
}

function defaultPreviewForChannel(channel: ChatThreadChannel, isDefault: boolean): string {
  if (channel === "STAFF") {
    return isDefault
      ? "Nhắn trực tiếp với nhân viên tư vấn"
      : "Cuộc trò chuyện mới với nhân viên AUREL";
  }
  return isDefault
    ? "Trợ lý AI tìm sản phẩm & tư vấn size"
    : "Cuộc trò chuyện mới với Bot AUREL";
}

function hydrateDefaults(conv: ChatConversation): ChatConversation {
  const inferredChannel: ChatThreadChannel =
    conv.channel ??
    (conv.mode === "STAFF" || conv.messages.some(m => m.senderRole === "STAFF") ? "STAFF" : "BOT");
  const isDefault = conv.isDefault ?? true;

  return {
    ...conv,
    channel: inferredChannel,
    pinned: conv.pinned ?? inferredChannel === "STAFF",
    isDefault,
    title: conv.title?.trim() || defaultTitleForChannel(inferredChannel, isDefault),
    hasStarted: conv.hasStarted ?? conv.messages.length > 0,
    botReplyCount: conv.botReplyCount ?? 0,
  };
}

function matchesParticipant(
  conv: ChatConversation,
  participant: { participantKey: string; userId: number | null },
): boolean {
  return (
    conv.participantKey === participant.participantKey ||
    (participant.userId !== null && conv.userId === participant.userId)
  );
}

function toSummary(conv: ChatConversation): ChatConversationSummary {
  const { messages, ...rest } = conv;
  return {
    ...rest,
    messageCount: messages.length,
  };
}

export function createChatStore(storeFilePath = DEFAULT_STORE_FILE) {
  let writeLock: Promise<void> = Promise.resolve();

  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = writeLock.then(task, task);
    writeLock = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function readStore(): Promise<StoreData> {
    try {
      const raw = await readFile(/* turbopackIgnore: true */ storeFilePath, "utf8");
      const parsed = JSON.parse(raw) as StoreData;
      if (!parsed || !Array.isArray(parsed.conversations)) {
        return { conversations: [] };
      }
      return {
        conversations: parsed.conversations.map(hydrateDefaults),
      };
    } catch {
      return { conversations: [] };
    }
  }

  async function writeStore(data: StoreData): Promise<void> {
    const dir = path.dirname(storeFilePath);
    await mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
    const tempPath = `${storeFilePath}.${randomUUID()}.tmp`;
    await writeFile(/* turbopackIgnore: true */ tempPath, JSON.stringify(data, null, 2), "utf8");
    await rename(/* turbopackIgnore: true */ tempPath, storeFilePath);
  }

  function welcomeMessage(
    conversationId: string,
    customerName: string,
    channel: ChatThreadChannel,
    nowIso: string,
  ): ChatMessage {
    if (channel === "STAFF") {
      return {
        id: `msg_${randomUUID()}`,
        conversationId,
        senderRole: "STAFF",
        senderName: "Chuyên viên AUREL",
        content: `Xin chào ${customerName}! Bạn đang kết nối trực tiếp với Chuyên viên tư vấn AUREL.\n\nHãy nhắn cho shop mẫu sản phẩm, kích cỡ hoặc mã đơn hàng bạn cần hỗ trợ nhé.`,
        createdAt: nowIso,
      };
    }

    return {
      id: `msg_${randomUUID()}`,
      conversationId,
      senderRole: "BOT",
      senderName: "AUREL Concierge Bot",
      content: `Xin chào ${customerName}! Mình là trợ lý AI của AUREL.\n\nBạn có thể hỏi mình tìm thiết kế theo phong cách, tư vấn chọn size, kiểm tra đơn hàng hoặc chính sách đổi trả bất cứ lúc nào.`,
      createdAt: nowIso,
      quickReplies: [...DEFAULT_QUICK_REPLIES],
    };
  }

  function buildNewConversation(input: {
    participantKey: string;
    userId: number | null;
    customerName: string;
    customerEmail: string | null;
    channel: ChatThreadChannel;
    isDefault: boolean;
    title?: string;
    nowIso: string;
  }): ChatConversation {
    const channel = input.channel;
    return {
      id: `conv_${randomUUID()}`,
      participantKey: input.participantKey,
      userId: input.userId,
      customerName: input.customerName || "Khách hàng",
      customerEmail: input.customerEmail,
      channel,
      title: input.title?.trim() || defaultTitleForChannel(channel, input.isDefault),
      pinned: channel === "STAFF",
      isDefault: input.isDefault,
      hasStarted: false,
      botReplyCount: 0,
      mode: channel === "STAFF" ? "WAITING_STAFF" : "BOT",
      status: "OPEN",
      unreadByStaff: 0,
      unreadByCustomer: 0,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
      lastMessagePreview: defaultPreviewForChannel(channel, input.isDefault),
      messages: [],
    };
  }

  function syncParticipantMetadata(
    conv: ChatConversation,
    input: {
      userId: number | null;
      customerName: string;
      customerEmail: string | null;
    },
  ): boolean {
    let dirty = false;
    if (input.userId !== null && conv.userId !== input.userId) {
      conv.userId = input.userId;
      dirty = true;
    }
    if (
      input.customerName &&
      input.customerName !== "Khách truy cập" &&
      conv.customerName !== input.customerName
    ) {
      conv.customerName = input.customerName;
      dirty = true;
    }
    if (input.customerEmail && conv.customerEmail !== input.customerEmail) {
      conv.customerEmail = input.customerEmail;
      dirty = true;
    }
    return dirty;
  }

  return {
    async getOrCreateByParticipant(input: {
      participantKey: string;
      userId: number | null;
      customerName: string;
      customerEmail: string | null;
      markReadByCustomer?: boolean;
      channel?: ChatThreadChannel;
    }): Promise<ChatConversation> {
      return serialized(async () => {
        const data = await readStore();
        const desiredChannel: ChatThreadChannel = input.channel ?? "BOT";
        const matching = data.conversations.filter(c => matchesParticipant(c, input));
        let conv =
          sortCustomerThreads(matching).find(c => c.channel === desiredChannel) ?? matching[0];

        const nowIso = new Date().toISOString();

        if (!conv) {
          conv = buildNewConversation({
            participantKey: input.participantKey,
            userId: input.userId,
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            channel: desiredChannel,
            isDefault: true,
            nowIso,
          });
          data.conversations.unshift(conv);
          await writeStore(data);
        } else {
          let dirty = syncParticipantMetadata(conv, input);
          if (input.markReadByCustomer && conv.unreadByCustomer > 0) {
            conv.unreadByCustomer = 0;
            dirty = true;
          }
          if (dirty) await writeStore(data);
        }

        return structuredClone(conv);
      });
    },

    async listParticipantConversations(input: {
      participantKey: string;
      userId: number | null;
      customerName: string;
      customerEmail: string | null;
    }): Promise<ChatConversation[]> {
      return serialized(async () => {
        const data = await readStore();
        let dirty = false;

        let matching = data.conversations.filter(c => matchesParticipant(c, input));
        for (const conv of matching) {
          if (syncParticipantMetadata(conv, input)) {
            dirty = true;
          }
        }

        const nowMs = Date.now();
        const hasStaff = matching.some(c => c.channel === "STAFF");
        const hasBot = matching.some(c => c.channel === "BOT");

        if (!hasStaff) {
          const staffConv = buildNewConversation({
            participantKey: input.participantKey,
            userId: input.userId,
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            channel: "STAFF",
            isDefault: true,
            nowIso: new Date(nowMs).toISOString(),
          });
          data.conversations.unshift(staffConv);
          matching.push(staffConv);
          dirty = true;
        }

        if (!hasBot) {
          const botConv = buildNewConversation({
            participantKey: input.participantKey,
            userId: input.userId,
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            channel: "BOT",
            isDefault: true,
            nowIso: new Date(nowMs + 1).toISOString(),
          });
          data.conversations.unshift(botConv);
          matching.push(botConv);
          dirty = true;
        }

        if (dirty) {
          await writeStore(data);
        }

        matching = data.conversations.filter(c => matchesParticipant(c, input));
        return sortCustomerThreads(matching).map(c => structuredClone(c));
      });
    },

    async createParticipantConversation(input: {
      participantKey: string;
      userId: number | null;
      customerName: string;
      customerEmail: string | null;
      channel?: ChatThreadChannel;
      title?: string;
    }): Promise<ChatConversation> {
      return serialized(async () => {
        const data = await readStore();
        const nowIso = new Date().toISOString();
        const channel: ChatThreadChannel = input.channel ?? "BOT";
        const conv = buildNewConversation({
          participantKey: input.participantKey,
          userId: input.userId,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          channel,
          isDefault: false,
          title: input.title,
          nowIso,
        });
        data.conversations.unshift(conv);
        await writeStore(data);
        return structuredClone(conv);
      });
    },

    async startConversation(conversationId: string): Promise<ChatConversation> {
      return serialized(async () => {
        const data = await readStore();
        const conv = data.conversations.find(c => c.id === conversationId);
        if (!conv) {
          throw new Error("Không tìm thấy cuộc hội thoại.");
        }

        if (!conv.hasStarted) {
          const nowIso = new Date().toISOString();
          conv.hasStarted = true;
          conv.mode = conv.channel === "STAFF" ? "WAITING_STAFF" : "BOT";
          if (conv.messages.length === 0) {
            const greeting = welcomeMessage(
              conv.id,
              conv.customerName || "Quý khách",
              conv.channel,
              nowIso,
            );
            conv.messages.push(greeting);
            conv.lastMessagePreview = greeting.content.replace(/\s+/g, " ").slice(0, 120);
            conv.updatedAt = nowIso;
          }
          await writeStore(data);
        }

        return structuredClone(conv);
      });
    },

    async getConversationById(
      conversationId: string,
      options?: { markReadByStaff?: boolean; markReadByCustomer?: boolean },
    ): Promise<ChatConversation | null> {
      return serialized(async () => {
        const data = await readStore();
        const conv = data.conversations.find(c => c.id === conversationId);
        if (!conv) return null;

        let dirty = false;
        if (options?.markReadByStaff && conv.unreadByStaff > 0) {
          conv.unreadByStaff = 0;
          dirty = true;
        }
        if (options?.markReadByCustomer && conv.unreadByCustomer > 0) {
          conv.unreadByCustomer = 0;
          dirty = true;
        }
        if (dirty) await writeStore(data);

        return structuredClone(conv);
      });
    },

    async listSummaries(): Promise<ChatConversationSummary[]> {
      const data = await readStore();
      return data.conversations
        .map(toSummary)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    },

    async appendMessage(input: {
      conversationId: string;
      senderRole: ChatSenderRole;
      senderName: string;
      content: string;
      suggestions?: ChatProductSuggestion[];
      quickReplies?: string[];
      nextMode?: ChatHandlingMode;
      nextStatus?: ChatConversationStatus;
      incrementBotReplyCount?: boolean;
    }): Promise<{ conversation: ChatConversation; message: ChatMessage }> {
      return serialized(async () => {
        const clean = sanitizeChatText(input.content);
        if (!clean || clean.length > MAX_MESSAGE_LENGTH) {
          throw new Error("Nội dung tin nhắn không hợp lệ (1–1500 ký tự).");
        }

        const data = await readStore();
        const conv = data.conversations.find(c => c.id === input.conversationId);
        if (!conv) {
          throw new Error("Không tìm thấy cuộc hội thoại.");
        }

        const hadCustomerMessage = conv.messages.some(m => m.senderRole === "CUSTOMER");
        const nowIso = new Date().toISOString();
        const message: ChatMessage = {
          id: `msg_${randomUUID()}`,
          conversationId: conv.id,
          senderRole: input.senderRole,
          senderName: input.senderName,
          content: clean,
          createdAt: nowIso,
          ...(input.suggestions?.length ? { suggestions: input.suggestions } : {}),
          ...(input.quickReplies?.length ? { quickReplies: input.quickReplies } : {}),
        };

        conv.hasStarted = true;
        conv.messages.push(message);
        if (conv.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
          conv.messages = conv.messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
        }

        if (!conv.isDefault && !hadCustomerMessage && input.senderRole === "CUSTOMER") {
          const compactTitle = clean.replace(/\s+/g, " ").trim();
          conv.title =
            compactTitle.length > 36 ? `${compactTitle.slice(0, 35)}…` : compactTitle;
        }

        conv.updatedAt = nowIso;
        conv.lastMessagePreview = clean.replace(/\s+/g, " ").slice(0, 120);

        if (input.senderRole === "CUSTOMER") {
          conv.unreadByStaff += 1;
          conv.unreadByCustomer = 0;
          if (conv.status === "RESOLVED") {
            conv.status = "OPEN";
          }
        } else {
          conv.unreadByCustomer += 1;
          conv.unreadByStaff = 0;
        }

        if (input.incrementBotReplyCount) {
          conv.botReplyCount = (conv.botReplyCount ?? 0) + 1;
        }
        if (input.nextMode) {
          conv.mode = input.nextMode;
        }
        if (input.nextStatus) {
          conv.status = input.nextStatus;
        }

        await writeStore(data);
        return { conversation: structuredClone(conv), message: structuredClone(message) };
      });
    },

    async updateControl(input: {
      conversationId: string;
      mode?: ChatHandlingMode;
      status?: ChatConversationStatus;
      resetBotReplyCount?: boolean;
      pinned?: boolean;
    }): Promise<ChatConversation> {
      return serialized(async () => {
        const data = await readStore();
        const conv = data.conversations.find(c => c.id === input.conversationId);
        if (!conv) {
          throw new Error("Không tìm thấy cuộc hội thoại.");
        }

        if (input.mode) conv.mode = input.mode;
        if (input.status) conv.status = input.status;
        if (typeof input.pinned === "boolean") conv.pinned = input.pinned;
        if (input.resetBotReplyCount) conv.botReplyCount = 0;
        conv.updatedAt = new Date().toISOString();

        await writeStore(data);
        return structuredClone(conv);
      });
    },
  };
}

export const defaultChatStore = createChatStore();
