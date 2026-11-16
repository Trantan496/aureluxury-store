import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createCustomerConversation,
  getCustomerChatState,
  postCustomerMessage,
  resolveOptionalCustomerUser,
  startCustomerConversation,
  switchCustomerBotMode,
  type CustomerParticipant,
} from "@/features/chat/chat-service";
import type { ChatThreadChannel } from "@/features/chat/types";
import { paymentBody, paymentHeaders } from "@/features/payments/http";
import { ShopError } from "@/features/shop/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUEST_COOKIE_NAME = "aurel_chat_guest";

function parseChannel(raw: unknown): ChatThreadChannel | null {
  return raw === "BOT" || raw === "STAFF" ? raw : null;
}

async function resolveParticipant(): Promise<{
  participant: CustomerParticipant;
  newGuestToken: string | null;
}> {
  const user = await resolveOptionalCustomerUser();
  if (user) {
    return {
      participant: {
        participantKey: `user:${user.id}`,
        userId: user.id,
        customerName: user.fullName || user.email,
        customerEmail: user.email,
      },
      newGuestToken: null,
    };
  }

  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  const validExisting = existing && /^[a-zA-Z0-9-]{8,64}$/.test(existing) ? existing : null;
  const token = validExisting ?? randomUUID();

  return {
    participant: {
      participantKey: `guest:${token}`,
      userId: null,
      customerName: "Khách truy cập",
      customerEmail: null,
    },
    newGuestToken: validExisting ? null : token,
  };
}

function attachGuestCookie(res: NextResponse, guestToken: string | null) {
  if (guestToken) {
    res.cookies.set(GUEST_COOKIE_NAME, guestToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId")?.trim() || null;
    const preferredChannel = parseChannel(url.searchParams.get("preferredChannel")?.trim());

    const { participant, newGuestToken } = await resolveParticipant();
    const state = await getCustomerChatState(participant, {
      conversationId,
      preferredChannel,
    });

    return attachGuestCookie(
      NextResponse.json({ data: state }, { headers: paymentHeaders }),
      newGuestToken,
    );
  } catch (error) {
    const message = error instanceof ShopError ? error.message : "Không thể tải cuộc trò chuyện.";
    const status = error instanceof ShopError ? error.status : 500;
    return NextResponse.json({ error: message }, { status, headers: paymentHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const body = await paymentBody(request, true);
    const { participant, newGuestToken } = await resolveParticipant();

    const operation = typeof body.operation === "string" ? body.operation : "send";
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId.trim() || null : null;
    const preferredChannel = parseChannel(body.preferredChannel);

    if (operation === "create") {
      const channel = parseChannel(body.channel) ?? "BOT";
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : undefined;
      const state = await createCustomerConversation(participant, { channel, title });
      return attachGuestCookie(
        NextResponse.json({ data: state }, { headers: paymentHeaders }),
        newGuestToken,
      );
    }

    if (operation === "start") {
      const state = await startCustomerConversation(participant, conversationId, preferredChannel);
      return attachGuestCookie(
        NextResponse.json({ data: state }, { headers: paymentHeaders }),
        newGuestToken,
      );
    }

    if (operation === "mode") {
      const mode = body.mode === "BOT" || body.mode === "WAITING_STAFF" ? body.mode : null;
      if (!mode) throw new ShopError("Chế độ hỗ trợ không hợp lệ.", 400);
      const state = await switchCustomerBotMode(participant, mode, conversationId);
      return attachGuestCookie(
        NextResponse.json({ data: state }, { headers: paymentHeaders }),
        newGuestToken,
      );
    }

    const content = typeof body.content === "string" ? body.content : "";
    const state = await postCustomerMessage(participant, content, {
      conversationId,
      preferredChannel,
    });
    return attachGuestCookie(
      NextResponse.json({ data: state }, { headers: paymentHeaders }),
      newGuestToken,
    );
  } catch (error) {
    const message = error instanceof ShopError ? error.message : "Không thể gửi tin nhắn.";
    const status = error instanceof ShopError ? error.status : 500;
    return NextResponse.json({ error: message }, { status, headers: paymentHeaders });
  }
}
