import {
  controlShopConversation,
  getShopConversation,
  listShopConversations,
  postStaffReply,
} from "@/features/chat/chat-service";
import { paymentBody, paymentResponse } from "@/features/payments/http";
import { ShopError } from "@/features/shop/rules";
import type { ChatConversationStatus, ChatHandlingMode } from "@/features/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return paymentResponse(async () => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    const summaries = await listShopConversations();
    const activeId = id || summaries[0]?.id || null;
    const activeConversation = activeId ? await getShopConversation(activeId) : null;
    return { conversations: summaries, activeConversation };
  });
}

export async function POST(request: Request) {
  return paymentResponse(async () => {
    const body = await paymentBody(request, true);
    const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
    if (!conversationId) throw new ShopError("Thiếu mã cuộc hội thoại.", 400);

    const operation = typeof body.operation === "string" ? body.operation : "reply";

    if (operation === "control") {
      const mode =
        body.mode === "BOT" || body.mode === "STAFF" || body.mode === "WAITING_STAFF"
          ? (body.mode as ChatHandlingMode)
          : undefined;
      const status =
        body.status === "OPEN" || body.status === "RESOLVED"
          ? (body.status as ChatConversationStatus)
          : undefined;
      if (!mode && !status) throw new ShopError("Thiếu trạng thái cần cập nhật.", 400);
      const conversation = await controlShopConversation(conversationId, { mode, status });
      return { conversation };
    }

    const content = typeof body.content === "string" ? body.content : "";
    const conversation = await postStaffReply(conversationId, content);
    return { conversation };
  });
}
