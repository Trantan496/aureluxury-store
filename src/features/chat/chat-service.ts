import "server-only";
import { resolveProductSession } from "@/lib/auth-session";
import { prisma } from "@/lib/db/client";
import { findSearchPage } from "@/lib/db/queries/products";
import { findChatProducts } from "@/lib/db/queries/chat-products";
import { planChatRetrieval, type ChatRetrievalPlan } from "./retrieval-plan";
import { sellerActor } from "@/features/orders/seller-orders";
import { ShopError } from "@/features/shop/rules";
import { formatAurelProductName } from "@/features/products/product-name";
import { generateGroqReply, type Retrieval } from "./groq-bot";
import { defaultChatStore, sanitizeChatText } from "./chat-store";
import {
  sortCustomerThreads,
  type ChatConversation,
  type ChatConversationStatus,
  type ChatConversationSummary,
  type ChatHandlingMode,
  type ChatProductSuggestion,
  type ChatThreadChannel,
} from "./types";

export type CustomerParticipant = {
  participantKey: string;
  userId: number | null;
  customerName: string;
  customerEmail: string | null;
};

function toSummary(conv: ChatConversation): ChatConversationSummary {
  const { messages, ...rest } = conv;
  return {
    ...rest,
    messageCount: messages.length,
  };
}

async function resolveParticipantThreads(
  participant: CustomerParticipant,
  options?: {
    conversationId?: string | null;
    preferredChannel?: ChatThreadChannel | null;
    markActiveRead?: boolean;
  },
): Promise<{
  conversation: ChatConversation;
  conversations: ChatConversationSummary[];
}> {
  const threads = await defaultChatStore.listParticipantConversations(participant);

  let selected: ChatConversation | undefined;
  if (options?.conversationId) {
    selected = threads.find(t => t.id === options.conversationId);
  }
  if (!selected && options?.preferredChannel) {
    selected = threads.find(t => t.channel === options.preferredChannel && t.mode === "BOT")
      ?? threads.find(t => t.channel === options.preferredChannel);
  }
  if (!selected) {
    const withMessages = [...threads]
      .filter(t => t.messages.length > 0 || t.hasStarted)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    selected = threads.find(t => t.channel === "BOT" && t.mode === "BOT")
      ?? threads.find(t => t.channel === "BOT") ?? withMessages[0] ?? threads[0];
  }

  if (options?.markActiveRead && selected.unreadByCustomer > 0) {
    const updated = await defaultChatStore.getConversationById(selected.id, {
      markReadByCustomer: true,
    });
    if (updated) {
      selected = updated;
    }
  }

  const summaries = sortCustomerThreads(
    threads.map(t => (t.id === selected!.id ? selected! : t)),
  ).map(toSummary);

  return {
    conversation: selected,
    conversations: summaries,
  };
}

export async function resolveOptionalCustomerUser(): Promise<{
  id: number;
  fullName: string;
  email: string;
  role: string;
} | null> {
  try {
    const session = await resolveProductSession();
    if (!session) return null;
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, fullName: true, email: true, role: true },
    });
    return user ?? null;
  } catch {
    return null;
  }
}

export async function findRealCatalogSuggestions(query: string): Promise<ChatProductSuggestion[]> {
  const clean = query.trim();
  if (!clean) return [];
  try {
    const page = await findSearchPage({
      q: clean.slice(0, 100),
      category: "",
      invalid: false,
      page: 1,
      pageSize: 3,
    });
    return page.products.slice(0, 3).map(product => ({
      id: product.id,
      slug: product.slug ?? product.id,
      name: formatAurelProductName(product.name),
      price: product.price ?? null,
      currency: product.currency ?? null,
      imageUrl: product.images?.find(img => img.url)?.url ?? null,
      categoryName: product.category?.name ?? null,
    }));
  } catch {
    return [];
  }
}

/** Read only, published catalog RAG; never retrieve customer/order/account tables. */
export async function retrieveChatCatalog(query: string, plan: ChatRetrievalPlan = planChatRetrieval(query)): Promise<Retrieval> {
  try {
    let matches = await findChatProducts(plan);
    if (!matches.length && plan.productIds?.length && plan.category) {
      matches = await findChatProducts({ ...plan, productIds: undefined });
    }
    const products = matches.map(product => {
      return {
        id: product.id, slug: product.slug ?? product.id,
        name: formatAurelProductName(product.name), price: product.price ?? null,
        currency: product.currency ?? null,
        imageUrl: product.images?.find(image => image.url)?.url ?? null,
        categoryName: product.category?.name ?? null,
        gender: product.profile?.gender ?? null,
        stock: product.stock ?? null,
        sizes: [...(product.sizes ?? [])], colors: [...(product.colors ?? [])],
        description: product.description?.replace(/<[^>]*>/g, " ").slice(0, 2500) ?? null,
        fabric: product.profile?.fabric ?? null, fit: product.profile?.fit ?? null,
        variants: product.variants?.slice(0, 30).map(variant => ({ size: variant.size, color: variant.color, stock: variant.stock, price: variant.price, currency: variant.currency ?? null })),
      };
    });
    return { status: "success", products };
  } catch { return { status: "error", products: [] }; }
}

export async function getCustomerChatState(
  participant: CustomerParticipant,
  options?: { conversationId?: string | null; preferredChannel?: ChatThreadChannel | null },
) {
  return resolveParticipantThreads(participant, {
    conversationId: options?.conversationId,
    preferredChannel: options?.preferredChannel,
    markActiveRead: true,
  });
}

export async function getCustomerConversation(participant: CustomerParticipant) {
  const state = await getCustomerChatState(participant);
  return state.conversation;
}

export async function createCustomerConversation(
  participant: CustomerParticipant,
  input?: { channel?: ChatThreadChannel; title?: string },
) {
  const created = await defaultChatStore.createParticipantConversation({
    ...participant,
    channel: input?.channel ?? "BOT",
    title: input?.title,
  });
  return resolveParticipantThreads(participant, {
    conversationId: created.id,
    markActiveRead: true,
  });
}

export async function startCustomerConversation(
  participant: CustomerParticipant,
  conversationId?: string | null,
  preferredChannel?: ChatThreadChannel | null,
) {
  const { conversation: target } = await resolveParticipantThreads(participant, {
    conversationId,
    preferredChannel,
  });
  const started = await defaultChatStore.startConversation(target.id);
  const { conversations } = await resolveParticipantThreads(participant, {
    conversationId: started.id,
  });
  return { conversation: started, conversations };
}

export async function postCustomerMessage(
  participant: CustomerParticipant,
  rawContent: string,
  options?: { conversationId?: string | null; preferredChannel?: ChatThreadChannel | null },
) {
  const clean = sanitizeChatText(rawContent);
  if (!clean) {
    throw new ShopError("Vui lòng nhập nội dung tin nhắn.", 400);
  }

  const { conversation: target } = await resolveParticipantThreads(participant, {
    conversationId: options?.conversationId,
    preferredChannel: options?.preferredChannel,
  });

  const { conversation: afterCustomer } = await defaultChatStore.appendMessage({
    conversationId: target.id,
    senderRole: "CUSTOMER",
    senderName: target.customerName,
    content: clean,
  });

  let active = afterCustomer;

  // Bot answers in BOT-mode threads; dedicated STAFF threads go straight to human Staff.
  if (afterCustomer.mode === "BOT") {
    const botReply = await generateGroqReply(clean, retrieveChatCatalog, target.messages);
    // Staff may have taken over while the external model was responding.
    const latest = await defaultChatStore.getConversationById(target.id);
    if (!latest || latest.mode !== "BOT") {
      return resolveParticipantThreads(participant, { conversationId: target.id });
    }
    const { conversation: withBot } = await defaultChatStore.appendMessage({
      conversationId: target.id,
      senderRole: "BOT",
      senderName: "AUREL Concierge Bot",
      content: botReply.content,
      suggestions: botReply.suggestions,
      quickReplies: botReply.quickReplies,
      nextMode: botReply.nextMode ?? "BOT",
      incrementBotReplyCount: true,
    });
    active = withBot;
  }

  const { conversations } = await resolveParticipantThreads(participant, {
    conversationId: active.id,
  });

  return { conversation: active, conversations };
}

export async function switchCustomerBotMode(
  participant: CustomerParticipant,
  mode: ChatHandlingMode,
  conversationId?: string | null,
) {
  const { conversation: target } = await resolveParticipantThreads(participant, {
    conversationId,
  });
  if (target.channel === "STAFF" && mode === "BOT") {
    throw new ShopError("Đây là hộp thư nhân viên. Vui lòng chọn cuộc trò chuyện với Trợ lý AI.", 400);
  }
  const updated = await defaultChatStore.updateControl({
    conversationId: target.id,
    mode,
    resetBotReplyCount: mode === "BOT",
  });
  const { conversations } = await resolveParticipantThreads(participant, {
    conversationId: updated.id,
  });
  return { conversation: updated, conversations };
}

// ---------------- ADMIN / SELLER INBOX SERVICE ----------------

export async function listShopConversations() {
  await sellerActor();
  const summaries = await defaultChatStore.listSummaries();
  return summaries.filter(item => item.messageCount > 0 || item.hasStarted);
}

export async function getShopConversation(conversationId: string) {
  await sellerActor();
  const conv = await defaultChatStore.getConversationById(conversationId, { markReadByStaff: true });
  if (!conv) throw new ShopError("Không tìm thấy hội thoại.", 404);
  return conv;
}

export async function postStaffReply(conversationId: string, rawContent: string) {
  const actor = await sellerActor();
  const clean = sanitizeChatText(rawContent);
  if (!clean) throw new ShopError("Vui lòng nhập nội dung phản hồi.", 400);

  let staffName = "Chuyên viên AUREL";
  try {
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { fullName: true } });
    if (user?.fullName?.trim()) staffName = `${user.fullName.trim()} (AUREL)`;
  } catch {
    // Keep default display name if user lookup fails
  }

  const { conversation } = await defaultChatStore.appendMessage({
    conversationId,
    senderRole: "STAFF",
    senderName: staffName,
    content: clean,
    nextMode: "STAFF",
    nextStatus: "OPEN",
  });
  return conversation;
}

export async function controlShopConversation(
  conversationId: string,
  input: { mode?: ChatHandlingMode; status?: ChatConversationStatus },
) {
  await sellerActor();
  return defaultChatStore.updateControl({
    conversationId,
    mode: input.mode,
    status: input.status,
    resetBotReplyCount: input.mode === "BOT",
  });
}
