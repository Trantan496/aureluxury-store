"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  DEFAULT_QUICK_REPLIES,
  type ChatConversation,
  type ChatConversationSummary,
  type ChatHandlingMode,
  type ChatThreadChannel,
} from "@/features/chat/types";
import styles from "./chat.module.css";
import { ReplyText } from "./reply-text";

const EMPTY_STATE_CARDS = [
  {
    id: "discover",
    eyebrow: "BỘ SƯU TẬP",
    title: "Tìm sản phẩm phù hợp",
    desc: "Gợi ý trang phục theo phong cách & dịp mặc",
    prompt: "Tìm áo khoác Trench Coat",
  },
  {
    id: "size",
    eyebrow: "CHUẨN PHOM",
    title: "Tư vấn chọn size",
    desc: "Tư vấn theo sản phẩm, số đo & phom mong muốn",
    prompt: "Tư vấn chọn size giúp mình",
  },
  {
    id: "orders",
    eyebrow: "ĐƠN HÀNG",
    title: "Theo dõi đơn & payOS",
    desc: "Kiểm tra trạng thái giao nhận và thanh toán",
    prompt: "Kiểm tra trạng thái đơn hàng & giao nhận",
  },
  {
    id: "specialist",
    eyebrow: "PRIVATE STYLING",
    title: "Kết nối Chuyên viên",
    desc: "Trò chuyện trực tiếp cùng Stylist AUREL",
    prompt: "Cho mình gặp chuyên viên tư vấn",
  },
] as const;

const HANDOFF_MARKER = "Từ tin nhắn tiếp theo, Chuyên viên tư vấn AUREL";

function formatMessageTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function formatSuggestionPrice(price: string | null, currency: string | null) {
  if (!price) return "Xem chi tiết sản phẩm";
  if (currency === "VND") {
    const num = Number(price);
    if (!Number.isNaN(num)) {
      return `${new Intl.NumberFormat("vi-VN").format(num)} ₫`;
    }
  }
  return currency ? `${price} ${currency}` : price;
}

function parseEditorialMessage(raw: string): {
  headline: string;
  body: string;
  handoffNote: string | null;
} {
  const markerIdx = raw.indexOf(HANDOFF_MARKER);
  let mainText = raw;
  let handoffNote: string | null = null;

  if (markerIdx !== -1) {
    mainText = raw.slice(0, markerIdx).trim();
    handoffNote = raw.slice(markerIdx).trim();
  }

  const trimmedMain = mainText.trim();
  const match = trimmedMain.match(/^([^.!?\n]+[.!?])\s*([\s\S]+)$/);
  if (match && match[1] && match[2]) {
    const cleanedBody = match[2].trim().replace(/:$/, ".");
    return {
      headline: match[1].trim(),
      body: cleanedBody,
      handoffNote,
    };
  }

  return {
    headline: trimmedMain,
    body: "",
    handoffNote,
  };
}

function SparkleIcon({ size = 13, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2 14.4 9.6 22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z" />
    </svg>
  );
}

/** Circular AUREL brand mark used for the AI concierge assistant avatar. */
export function AurelLogoAvatar({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/images/aurel/aurel-logo.webp"
      alt=""
      width={size}
      height={size}
      className={styles.avatarLogoImg}
      unoptimized
    />
  );
}

export type ChatPanelHandle = {
  send: (text: string) => Promise<void>;
  start: () => Promise<void>;
  create: (channel?: ChatThreadChannel) => Promise<void>;
};

export function ChatPanel({
  variant = "drawer",
  conversationId,
  preferredChannel,
  onClose,
  chatRef,
  onStateChange,
}: {
  variant?: "drawer" | "page";
  conversationId?: string | null;
  preferredChannel?: ChatThreadChannel;
  onClose?: () => void;
  chatRef?: React.Ref<ChatPanelHandle>;
  onStateChange?: (payload: {
    conversation: ChatConversation;
    conversations: ChatConversationSummary[];
  }) => void;
}) {
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [overrideChannel, setOverrideChannel] = useState<ChatThreadChannel | undefined>(
    preferredChannel,
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [animatedReplyId, setAnimatedReplyId] = useState<string | null>(null);
  const [completedReplyId, setCompletedReplyId] = useState<string | null>(null);
  const followScrollRef = useRef(true);
  const completeReply = useCallback((id: string) => setCompletedReplyId(id), []);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeTargetChannel = overrideChannel ?? preferredChannel;
  const activeConvId = conversationId ?? conversation?.id ?? undefined;

  const buildChatQuery = useCallback(
    (targetConvId?: string | null, targetChannel?: ChatThreadChannel) => {
      const params = new URLSearchParams();
      if (targetConvId) params.set("conversationId", targetConvId);
      else if (targetChannel) params.set("preferredChannel", targetChannel);
      const qs = params.toString();
      return qs ? `/api/chat?${qs}` : "/api/chat";
    },
    [],
  );

  const syncPayload = useCallback(
    (data: { conversation: ChatConversation; conversations?: ChatConversationSummary[] }) => {
      setConversation(data.conversation);
      if (data.conversations) {
        onStateChange?.({
          conversation: data.conversation,
          conversations: data.conversations,
        });
      }
    },
    [onStateChange],
  );

  const fetchConversation = useCallback(
    async (targetConvId?: string | null, targetChannel?: ChatThreadChannel, quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await fetch(buildChatQuery(targetConvId, targetChannel), {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Không thể tải cuộc trò chuyện.");
        syncPayload(json.data);
        setError("");
      } catch (err) {
        if (!quiet) {
          setError(err instanceof Error ? err.message : "Kết nối tạm thời gián đoạn.");
        }
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [buildChatQuery, syncPayload],
  );

  // Initial load & when external conversationId changes
  useEffect(() => {
    let active = true;
    const url = buildChatQuery(conversationId, conversationId ? undefined : activeTargetChannel);
    fetch(url, { cache: "no-store" })
      .then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Không thể tải cuộc trò chuyện.");
        if (!active) return;
        syncPayload(json.data);
        setError("");
      })
      .catch(err => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Kết nối tạm thời gián đoạn.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTargetChannel, buildChatQuery, conversationId, syncPayload]);

  // Auto-poll every 3.5s while visible so Staff replies show up automatically
  useEffect(() => {
    const targetId = conversationId ?? conversation?.id ?? null;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !sending) {
        void fetchConversation(targetId, activeTargetChannel, true);
      }
    }, 3500);
    return () => clearInterval(timer);
  }, [activeTargetChannel, conversation?.id, conversationId, fetchConversation, sending]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && followScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [conversation?.id, conversation?.messages.length, conversation?.hasStarted, completedReplyId]);

  useEffect(() => {
    if (!menuOpen && !attachOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen, attachOpen]);

  const createConversation = useCallback(
    async (channel: ChatThreadChannel = "BOT") => {
      if (sending || loading) return;
      setSending(true);
      setError("");
      setMenuOpen(false);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "create", channel }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Không thể tạo đoạn chat mới.");
        setOverrideChannel(channel);
        syncPayload(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể tạo đoạn chat mới.");
      } finally {
        setSending(false);
      }
    },
    [loading, sending, syncPayload],
  );

  const startConversation = useCallback(async () => {
    if (sending || loading) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "start",
          conversationId: activeConvId,
          preferredChannel: activeTargetChannel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể bắt đầu cuộc hội thoại.");
      syncPayload(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể bắt đầu cuộc hội thoại.");
    } finally {
      setSending(false);
    }
  }, [activeConvId, activeTargetChannel, loading, sending, syncPayload]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending || loading) return;
      followScrollRef.current = true;
      setSending(true);
      setError("");
      setAttachOpen(false);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "send",
            content: trimmed,
            conversationId: activeConvId,
            preferredChannel: activeTargetChannel,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Không thể gửi tin nhắn.");
        const reply = (json.data.conversation as ChatConversation).messages.at(-1);
        setAnimatedReplyId(reply?.senderRole === "BOT" ? reply.id : null);
        syncPayload(json.data);
        setDraft("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gửi tin nhắn thất bại.");
      } finally {
        setSending(false);
      }
    },
    [activeConvId, activeTargetChannel, loading, sending, syncPayload],
  );

  useImperativeHandle(
    chatRef,
    () => ({
      send: sendMessage,
      start: startConversation,
      create: createConversation,
    }),
    [createConversation, sendMessage, startConversation],
  );

  const switchToChannel = async (targetChannel: ChatThreadChannel) => {
    if (sending) return;
    setMenuOpen(false);
    setOverrideChannel(targetChannel);
    await fetchConversation(null, targetChannel, false);
  };

  const switchMode = async (nextMode: ChatHandlingMode) => {
    if (sending) return;
    setSending(true);
    setError("");
    setMenuOpen(false);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "mode",
          mode: nextMode,
          conversationId: conversationId ?? conversation?.id ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể chuyển chế độ hỗ trợ.");
      syncPayload(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể chuyển chế độ.");
    } finally {
      setSending(false);
    }
  };

  const channel: ChatThreadChannel = conversation?.channel ?? activeTargetChannel ?? "BOT";
  const mode = conversation?.mode ?? (channel === "STAFF" ? "WAITING_STAFF" : "BOT");
  const hasStarted = Boolean(conversation?.hasStarted || (conversation?.messages.length ?? 0) > 0);
  const messages = conversation?.messages ?? [];

  const customerFirstName =
    conversation?.customerName && conversation.customerName !== "Khách truy cập"
      ? conversation.customerName.split(" ").slice(-1)[0]
      : null;

  const headerTitle =
    variant === "drawer"
      ? channel === "STAFF" || mode === "STAFF" || mode === "WAITING_STAFF"
        ? "Nhân viên AUREL"
        : "aurel Official"
      : conversation?.title || (channel === "STAFF" ? "Nhân viên AUREL" : "AUREL Concierge Bot");

  const statusText = channel === "BOT" && mode === "BOT"
    ? "Đang hoạt động"
    : "Hộp thư nhân viên · AI đang tắt";

  const showQuickReplies = hasStarted && channel === "BOT" && mode === "BOT";

  return (
    <>
      <header
        className={`${styles.panelHeader} ${
          variant === "drawer" ? styles.panelHeaderDrawer : ""
        }`}
      >
        {variant === "page" && (
          <div className={styles.headerEditorialAccentWrap} aria-hidden="true">
            <Image
              src="/images/aurel/aurel-edit-modern-minimalist.png"
              alt=""
              width={340}
              height={180}
              className={styles.headerEditorialAccent}
              aria-hidden="true"
              unoptimized
            />
          </div>
        )}

        <div className={styles.panelIdentity}>
          <span
            className={`${styles.avatarWrap} ${styles.avatarWrapHeader} ${
              channel === "STAFF" ? "" : styles.avatarWrapLogo
            }`}
            aria-hidden="true"
          >
            {channel === "STAFF" ? "N" : <AurelLogoAvatar size={40} />}
          </span>
          <div className={styles.panelIdentityText}>
            <h2 className={styles.panelTitle}>
              {headerTitle}
              {variant === "drawer" && channel === "BOT" ? "" : ""}
            </h2>
            <p className={styles.panelStatus}>
              <span
                className={`${styles.panelStatusDot} ${
                  mode === "WAITING_STAFF" ? styles.panelStatusDotConnecting : ""
                }`}
                aria-hidden="true"
              />
              <span>{statusText}</span>
            </p>
          </div>
        </div>

        <div className={styles.headerControls} ref={menuRef}>
          {variant === "drawer" && (
            <Link
              href="/messages"
              className={styles.headerIconBtn}
              title="Mở toàn màn hình"
              aria-label="Mở trang nhắn tin đầy đủ"
              onClick={onClose}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}

          <div className={styles.headerMenuWrap}>
            <button
              type="button"
              className={styles.headerIconBtn}
              title="Thao tác"
              aria-label="Mở menu thao tác"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(prev => !prev)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="19" cy="12" r="1.7" />
              </svg>
            </button>

            {menuOpen && (
              <div className={styles.headerMenu} role="menu">
                <button
                  type="button"
                  className={styles.headerMenuItem}
                  role="menuitem"
                  disabled={sending || loading}
                  onClick={() => void createConversation("BOT")}
                >
                  + Đoạn chat mới với Bot
                </button>
                <button
                  type="button"
                  className={styles.headerMenuItem}
                  role="menuitem"
                  disabled={sending || loading}
                  onClick={() => void createConversation("STAFF")}
                >
                  + Đoạn chat mới với Nhân viên
                </button>
                {variant === "drawer" && (
                  <button
                    type="button"
                    className={styles.headerMenuItem}
                    role="menuitem"
                    disabled={sending || loading}
                    onClick={() => void switchToChannel(channel === "BOT" ? "STAFF" : "BOT")}
                  >
                    {channel === "BOT"
                      ? "Chuyển sang Nhân viên AUREL"
                      : "Chuyển sang Bot AUREL"}
                  </button>
                )}
                {mode === "BOT" ? (
                  <button
                    type="button"
                    className={styles.headerMenuItem}
                    role="menuitem"
                    disabled={sending || loading}
                    onClick={() => void switchMode("WAITING_STAFF")}
                  >
                    Kết nối Chuyên viên trong chat này
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.headerMenuItem}
                    role="menuitem"
                    disabled={sending || loading}
                    onClick={() => channel === "STAFF" ? void switchToChannel("BOT") : void switchMode("BOT")}
                  >
                    Bật lại Trợ lý AI
                  </button>
                )}
                <Link
                  href="/products?page=1"
                  className={styles.headerMenuItem}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    if (variant === "drawer") onClose?.();
                  }}
                >
                  Khám phá Bộ sưu tập
                </Link>
                <Link
                  href="/account/orders"
                  className={styles.headerMenuItem}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    if (variant === "drawer") onClose?.();
                  }}
                >
                  Đơn hàng của tôi
                </Link>
              </div>
            )}
          </div>

          {onClose && (
            <button
              type="button"
              className={styles.headerIconBtn}
              aria-label="Đóng hộp thoại nhắn tin"
              onClick={onClose}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Floating Status Banner */}
      <div
        className={`${styles.modeStrip} ${
          variant === "drawer" ? styles.modeStripDrawer : ""
        } ${
          mode === "STAFF"
            ? styles.modeStripStaff
            : mode === "WAITING_STAFF"
              ? styles.modeStripWaiting
              : ""
        }`}
      >
        <span className={styles.modeStripLabel}>
          <SparkleIcon size={12} className={styles.modeSparkle} />
          <span>
            {variant === "drawer"
              ? channel === "BOT" && mode === "BOT"
                ? "Hỗ trợ AI 24/7"
                : "AI đang tắt · Hộp thư nhân viên"
              : channel === "BOT" && mode === "BOT"
                ? "Đang trò chuyện cùng Trợ lý AI AUREL."
                : "AI đang tắt · Tin nhắn đang gửi tới nhân viên."}
          </span>
        </span>
        {channel === "BOT" && mode === "BOT" ? (
          <button
            type="button"
            className={styles.modeActionLink}
            disabled={sending || loading}
            onClick={() => void switchToChannel("STAFF")}
          >
            Nhắn Nhân viên
          </button>
        ) : (
          <button
            type="button"
            className={styles.modeActionLink}
            disabled={sending || loading}
            onClick={() =>
              channel === "STAFF" ? void switchToChannel("BOT") : void switchMode("BOT")
            }
          >
            Bật trợ lý AI
          </button>
        )}
      </div>

      {(channel === "STAFF" || mode !== "BOT") && (
        <p className={styles.handoffNotice} role="status">
          Tin nhắn đang gửi tới nhân viên nên AI sẽ không tự trả lời. Chọn “Bật trợ lý AI” để được hỗ trợ ngay.
        </p>
      )}

      <div ref={scrollRef} className={styles.messagesScroll} role="log" aria-live="polite" data-lenis-prevent
        onScroll={event => {
          const log = event.currentTarget;
          followScrollRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 64;
        }}>
        <div className={variant === "page" ? styles.messagesContainer : styles.messagesContainerDrawer}>
          {loading ? (
            <div className={styles.loadingState}>
              <span className={styles.loadingDot} data-motion-activity="pulse" aria-hidden="true" />
              <p>Đang kết nối AUREL Concierge…</p>
            </div>
          ) : !hasStarted ? (
            <div className={styles.emptyState}>
              <div
                className={`${styles.avatarWrap} ${styles.avatarWrapLg} ${
                  channel === "STAFF" ? "" : styles.avatarWrapLogo
                }`}
                aria-hidden="true"
              >
                {channel === "STAFF" ? "N" : <AurelLogoAvatar size={56} />}
              </div>
              <p className={styles.emptyEyebrow}>
                {channel === "STAFF"
                  ? "AUREL · CHUYÊN VIÊN TƯ VẤN"
                  : "AUREL · PRIVATE CONCIERGE"}
              </p>
              <h3 className={styles.emptyTitle}>
                {channel === "STAFF"
                  ? "Nhắn trực tiếp với Nhân viên AUREL"
                  : customerFirstName
                    ? `Xin chào ${customerFirstName}, How can we assist you today?`
                    : "How can we assist you today?"}
              </h3>
              <p className={styles.emptySubtitle}>
                {channel === "STAFF"
                  ? "Phòng tư vấn riêng với Chuyên viên AUREL — gửi câu hỏi về sản phẩm, size hoặc đơn hàng của bạn."
                  : "Trợ lý AI giải đáp tức thì về sản phẩm thật từ kho, bảng size, đơn hàng và chính sách đổi trả."}
              </p>

              <div className={variant === "page" ? styles.emptyCardsGrid : styles.emptyCardsStack}>
                {EMPTY_STATE_CARDS.map(card => (
                  <button
                    key={card.id}
                    type="button"
                    className={styles.emptyCard}
                    disabled={sending}
                    onClick={() => void sendMessage(card.prompt)}
                  >
                    <span className={styles.emptyCardEyebrow}>{card.eyebrow}</span>
                    <span className={styles.emptyCardTitle}>{card.title}</span>
                    <span className={styles.emptyCardDesc}>{card.desc}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={styles.startConvBtn}
                disabled={sending}
                onClick={() => void startConversation()}
              >
                {sending
                  ? "Đang bắt đầu…"
                  : channel === "STAFF"
                    ? "Bắt đầu trò chuyện với Nhân viên"
                    : "Bắt đầu cuộc hội thoại"}
              </button>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isCustomer = msg.senderRole === "CUSTOMER";
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const isSameSenderGroup = prevMsg?.senderRole === msg.senderRole;
              const timeLabel = formatMessageTime(msg.createdAt);

              if (isCustomer) {
                return (
                  <div
                    key={msg.id}
                    className={`${styles.messageRow} ${styles.messageRowCustomer} ${
                      isSameSenderGroup ? styles.messageRowGrouped : ""
                    }`}
                  >
                    <div className={styles.customerBubbleCol}>
                      <span className={styles.messageTimeTop}>{timeLabel}</span>
                      <div className={`${styles.bubble} ${styles.bubbleCustomer}`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              }

              const hasSuggestions = Boolean(msg.suggestions && msg.suggestions.length > 0);
              const parsed = parseEditorialMessage(msg.content);

              return (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${styles.messageRowShop} ${
                    hasSuggestions ? styles.messageRowWide : ""
                  } ${isSameSenderGroup ? styles.messageRowGrouped : ""}`}
                >
                  <div className={styles.shopMessageCol}>
                    {!isSameSenderGroup && (
                      <div className={styles.botHeaderRow}>
                        <span className={styles.botSenderName}>{msg.senderName}</span>
                        {msg.senderRole === "STAFF" && (
                          <span className={styles.roleBadgeStaff}>CHUYÊN VIÊN</span>
                        )}
                        <span className={styles.botHeaderTime}>{timeLabel}</span>
                      </div>
                    )}

                      <div
                        className={`${styles.bubble} ${
                          msg.senderRole === "STAFF" ? styles.bubbleStaff : styles.bubbleBot
                        }`}
                      >
                        <p className={styles.bubbleText}>
                          <ReplyText animate={msg.id === animatedReplyId} messageId={msg.id} onComplete={completeReply} text={parsed.handoffNote
                            ? `${parsed.headline}${parsed.body ? ` ${parsed.body}` : ""}`
                            : msg.content} />
                        </p>
                        {parsed.handoffNote && (
                          <p className={styles.editorialCardNote}>
                            <SparkleIcon size={12} className={styles.modeSparkle} />
                            <span>{parsed.handoffNote}</span>
                          </p>
                        )}
                      </div>

                    {hasSuggestions && msg.suggestions && (msg.id !== animatedReplyId || completedReplyId === msg.id) && (
                      <div
                        className={
                          variant === "page" ? styles.suggestionGrid : styles.suggestionList
                        }
                      >
                        {msg.suggestions.map(item => (
                          <Link
                            key={item.id}
                            href={`/products/${encodeURIComponent(item.slug)}`}
                            className={styles.suggestionCard}
                            onClick={variant === "drawer" ? onClose : undefined}
                          >
                            {item.imageUrl && (
                              <Image
                                src={item.imageUrl}
                                alt={item.name}
                                width={64}
                                height={82}
                                className={styles.suggestionThumb}
                                unoptimized
                              />
                            )}
                            <div className={styles.suggestionInfo}>
                              <p className={styles.suggestionName}>{item.name}</p>
                              <p className={styles.suggestionMeta}>
                                {formatSuggestionPrice(item.price, item.currency)}
                              </p>
                              {item.categoryName && (
                                <p className={styles.suggestionCategory}>{item.categoryName}</p>
                              )}
                              {(item.sizes?.length || item.colors?.length) ? (
                                <p className={styles.suggestionCategory}>{[item.sizes?.join(" / "), item.colors?.join(" · ")].filter(Boolean).join(" · ")}</p>
                              ) : null}
                              {typeof item.stock === "number" && (
                                <span className={styles.suggestionStock} title="Tồn kho tại thời điểm kiểm tra">{item.stock > 0 ? `Còn ${item.stock}` : "Hết hàng"}</span>
                              )}
                            </div>
                            <div className={styles.suggestionAside} aria-hidden="true">
                              <svg
                                className={styles.suggestionHeart}
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                              >
                                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
                              </svg>
                              <span className={styles.suggestionChevronBtn}>
                                <svg
                                  width="11"
                                  height="11"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                >
                                  <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    <div className={styles.botFooterMeta}>
                      <span
                        className={`${styles.avatarWrap} ${styles.avatarWrapXs} ${
                          msg.senderRole === "STAFF" ? styles.avatarWrapStaff : styles.avatarWrapLogo
                        }`}
                        aria-hidden="true"
                      >
                        {msg.senderRole === "BOT" ? <AurelLogoAvatar size={26} /> : "N"}
                      </span>
                      <span className={styles.messageTime}>{timeLabel}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {sending && <div className={styles.typingDots} role="status" aria-label="Đang phản hồi"><span /><span /><span /></div>}
        </div>
      </div>

      {showQuickReplies && (
        <div className={styles.quickRepliesWrap} aria-label="Gợi ý câu hỏi nhanh">
          {DEFAULT_QUICK_REPLIES.map(reply => (
            <button
              key={reply}
              type="button"
              className={styles.quickReplyChip}
              disabled={sending || loading}
              onClick={() => void sendMessage(reply)}
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {attachOpen && (
        <div className={styles.quickRepliesWrap} aria-label="Gửi nhanh yêu cầu">
          {EMPTY_STATE_CARDS.map(card => (
            <button
              key={card.id}
              type="button"
              className={styles.quickReplyChip}
              disabled={sending || loading}
              onClick={() => void sendMessage(card.prompt)}
            >
              {card.title}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className={styles.chatError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.composerDock}>
        <form
          className={styles.composerBar}
          onSubmit={event => {
            event.preventDefault();
            if (draft.trim()) {
              void sendMessage(draft);
            }
          }}
        >
          <button
            type="button"
            className={styles.composerToolBtn}
            title="Chọn nhanh chủ đề hoặc đính kèm yêu cầu"
            aria-label="Mở gợi ý nhanh"
            aria-expanded={attachOpen}
            disabled={sending || loading}
            onClick={() => setAttachOpen(prev => !prev)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path
                d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className={styles.composerSparkleBtn}
            title="Gợi ý câu hỏi AI AUREL"
            aria-label="Gợi ý câu hỏi nhanh"
            aria-expanded={attachOpen}
            disabled={sending || loading}
            onClick={() => setAttachOpen(prev => !prev)}
          >
            <SparkleIcon size={13} />
          </button>

          <input
            type="text"
            className={styles.composerInput}
            placeholder="Nhắn với AUREL Concierge..."
            aria-label="Nhập tin nhắn"
            value={draft}
            maxLength={1500}
            disabled={loading}
            onChange={e => setDraft(e.target.value)}
          />

          <button
            type="submit"
            className={styles.composerSendBtn}
            aria-label="Gửi tin nhắn"
            title="Gửi tin nhắn"
            disabled={sending || loading || !draft.trim()}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m22 2-7 20-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
