"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatConversation,
  ChatConversationStatus,
  ChatConversationSummary,
  ChatHandlingMode,
} from "@/features/chat/types";
import { SellerPortalNav } from "./seller-portal-nav";
import styles from "./seller-messages.module.css";

function formatShortTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function SellerMessages() {
  const [summaries, setSummaries] = useState<ChatConversationSummary[]>([]);
  const [active, setActive] = useState<ChatConversation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadInbox = useCallback(async (targetId?: string | null, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const query = targetId ? `?id=${encodeURIComponent(targetId)}` : "";
      const res = await fetch(`/api/admin/messages${query}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không thể tải hộp thư khách hàng.");
      setSummaries(json.data.conversations ?? []);
      setActive(json.data.activeConversation ?? null);
      if (!targetId && json.data.activeConversation?.id) {
        setSelectedId(json.data.activeConversation.id);
      }
      setError("");
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Không thể kết nối hộp thư.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let activeFlag = true;
    const query = selectedId ? `?id=${encodeURIComponent(selectedId)}` : "";
    fetch(`/api/admin/messages${query}`, { cache: "no-store" })
      .then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Không thể tải hộp thư khách hàng.");
        if (!activeFlag) return;
        setSummaries(json.data.conversations ?? []);
        setActive(json.data.activeConversation ?? null);
        if (!selectedId && json.data.activeConversation?.id) {
          setSelectedId(json.data.activeConversation.id);
        }
        setError("");
      })
      .catch(err => {
        if (!activeFlag) return;
        setError(err instanceof Error ? err.message : "Không thể kết nối hộp thư.");
      })
      .finally(() => {
        if (activeFlag) setLoading(false);
      });
    return () => {
      activeFlag = false;
    };
  }, [selectedId]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadInbox(selectedId, true);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [loadInbox, selectedId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [active?.messages.length]);

  const sendReply = async (textOverride?: string) => {
    const text = (textOverride ?? reply).trim();
    if (!active || !text || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "reply",
          conversationId: active.id,
          content: text,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gửi phản hồi thất bại.");
      setActive(json.data.conversation);
      if (!textOverride) setReply("");
      void loadInbox(active.id, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gửi phản hồi thất bại.");
    } finally {
      setSending(false);
    }
  };

  const updateControl = async (input: {
    mode?: ChatHandlingMode;
    status?: ChatConversationStatus;
  }) => {
    if (!active || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "control",
          conversationId: active.id,
          ...input,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Cập nhật trạng thái thất bại.");
      setActive(json.data.conversation);
      void loadInbox(active.id, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật trạng thái.");
    } finally {
      setSending(false);
    }
  };

  const filteredSummaries = summaries.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.customerName.toLowerCase().includes(q) ||
      (item.customerEmail ?? "").toLowerCase().includes(q) ||
      item.lastMessagePreview.toLowerCase().includes(q)
    );
  });

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.portalWrap}>
          <SellerPortalNav active="messages" />
        </div>

        {error && (
          <p role="alert" style={{ color: "#fca5a5", marginBottom: 10, fontSize: 13 }}>
            {error}
          </p>
        )}

        <div className={styles.messengerShell}>
          {/* Left Icon Rail */}
          <nav className={styles.messengerRail} aria-label="Điều hướng hộp thư Người bán">
            <div className={styles.railGroup}>
              <Link
                href="/admin/messages"
                className={`${styles.railBtn} ${styles.railBtnActive}`}
                aria-current="page"
                title="Đoạn chat"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.91 1.44 5.5 3.7 7.19V22l3.41-1.88c.91.25 1.88.39 2.89.39 5.52 0 10-4.15 10-9.24S17.52 2 12 2Zm1 12.44-2.55-2.72-4.97 2.72 5.47-5.8 2.61 2.72 4.91-2.72L13 14.44Z" />
                </svg>
              </Link>
              <Link href="/admin/orders" className={styles.railBtn} title="Đơn hàng">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M6 3h12l2 4v14H4V7l2-4Z" />
                  <path d="M4 7h16M9 11a3 3 0 0 0 6 0" />
                </svg>
              </Link>
              <Link href="/admin/products" className={styles.railBtn} title="Sản phẩm">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="m3 8 9-5 9 5v8l-9 5-9-5V8Z" />
                  <path d="m3 8 9 5 9-5M12 13v8" />
                </svg>
              </Link>
            </div>
            <div className={styles.railGroup}>
              <Link href="/products" className={styles.railBtn} title="Xem cửa hàng">
                ↗
              </Link>
            </div>
          </nav>

          {/* Column 2: Customer Thread Sidebar */}
          <aside className={styles.threadSidebar} aria-label="Danh sách đoạn chat khách hàng">
            <div className={styles.sidebarHeader}>
              <h1>Đoạn chat</h1>
              <button
                type="button"
                className={styles.circleBtn}
                title="Làm mới danh sách"
                aria-label="Làm mới hộp thư"
                onClick={() => void loadInbox(selectedId, false)}
              >
                ↻
              </button>
            </div>

            <div className={styles.searchWrap}>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Tìm kiếm trên Messenger"
                aria-label="Tìm kiếm khách hàng hoặc nội dung"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className={styles.threadListScroll}>
              {loading && summaries.length === 0 ? (
                <p className={styles.emptyState}>Đang tải đoạn chat…</p>
              ) : filteredSummaries.length === 0 ? (
                <p className={styles.emptyState}>
                  Chưa có tin nhắn nào. Khi khách hàng nhấn &quot;Bắt đầu cuộc hội thoại&quot; hoặc
                  nhắn qua hộp thoại bên phải / trang /messages, cuộc trò chuyện sẽ hiện tại đây.
                </p>
              ) : (
                filteredSummaries.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.threadItem} ${
                      active?.id === item.id ? styles.threadItemActive : ""
                    }`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className={styles.avatarCircle} aria-hidden="true">
                      {(item.customerName[0] ?? "K").toUpperCase()}
                      <span
                        className={`${styles.onlineDot} ${
                          item.mode === "WAITING_STAFF" ? styles.onlineDotWaiting : ""
                        }`}
                      />
                    </span>

                    <div className={styles.threadBody}>
                      <div className={styles.threadTop}>
                        <span className={styles.threadName}>
                          {item.customerName}
                          {item.title ? ` · ${item.title}` : ""}
                        </span>
                        <span className={styles.threadTime}>{formatShortTime(item.updatedAt)}</span>
                      </div>
                      <div className={styles.threadBottom}>
                        <p className={styles.threadPreview}>{item.lastMessagePreview}</p>
                        {item.unreadByStaff > 0 && <span className={styles.unreadDot} />}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Column 3: Active Customer Conversation */}
          <section className={styles.chatPane} aria-label="Chi tiết đoạn chat">
            {!active ? (
              <div className={styles.emptyState} style={{ margin: "auto" }}>
                Chọn một đoạn chat bên trái để trò chuyện trực tiếp cùng khách hàng.
              </div>
            ) : (
              <>
                <header className={styles.conversationHeader}>
                  <div className={styles.customerIdentity}>
                    <span
                      className={`${styles.avatarCircle} ${styles.avatarCircleSm}`}
                      aria-hidden="true"
                    >
                      {(active.customerName[0] ?? "K").toUpperCase()}
                      <span
                        className={`${styles.onlineDot} ${
                          active.mode === "WAITING_STAFF" ? styles.onlineDotWaiting : ""
                        }`}
                      />
                    </span>
                    <div>
                      <h2>{active.customerName}</h2>
                      <p>
                        {active.customerEmail ?? "Khách truy cập"} ·{" "}
                        {active.mode === "WAITING_STAFF"
                          ? "Đang chờ nhân viên phản hồi"
                          : active.mode === "STAFF"
                            ? "Nhân viên đang trực tiếp hỗ trợ"
                            : "Bot mở đầu"}
                      </p>
                    </div>
                  </div>
                  <div className={styles.controlActions}>
                    {active.mode !== "BOT" ? (
                      <button
                        type="button"
                        className={styles.controlBtn}
                        disabled={sending}
                        onClick={() => void updateControl({ mode: "BOT" })}
                      >
                        Bật lại Bot mở đầu
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.controlBtn}
                        disabled={sending}
                        onClick={() => void updateControl({ mode: "STAFF" })}
                      >
                        Nhân viên tiếp nhận
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.controlBtn}
                      disabled={sending}
                      onClick={() =>
                        void updateControl({
                          status: active.status === "RESOLVED" ? "OPEN" : "RESOLVED",
                        })
                      }
                    >
                      {active.status === "RESOLVED" ? "Mở lại" : "Hoàn tất"}
                    </button>
                  </div>
                </header>

                <div ref={scrollRef} className={styles.messagesArea}>
                  {active.messages.length === 0 ? (
                    <div className={styles.emptyState}>
                      Khách hàng chưa gửi tin nhắn mở đầu. Bạn có thể chủ động nhắn tin cho khách
                      ngay bên dưới.
                    </div>
                  ) : (
                    active.messages.map(msg => {
                      const isCustomer = msg.senderRole === "CUSTOMER";
                      return (
                        <div
                          key={msg.id}
                          className={`${styles.msgBlock} ${
                            isCustomer ? styles.msgBlockCustomer : styles.msgBlockShop
                          }`}
                        >
                          {isCustomer && (
                            <span
                              className={`${styles.avatarCircle} ${styles.avatarCircleXs}`}
                              aria-hidden="true"
                            >
                              {(active.customerName[0] ?? "K").toUpperCase()}
                            </span>
                          )}
                          <div className={styles.msgContentCol}>
                            <p className={styles.msgSender}>
                              {msg.senderName} · {formatShortTime(msg.createdAt)}
                            </p>
                            <div
                              className={`${styles.msgBubble} ${
                                isCustomer
                                  ? styles.msgBubbleCustomer
                                  : msg.senderRole === "BOT"
                                    ? styles.msgBubbleBot
                                    : styles.msgBubbleStaff
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form
                  className={styles.replyForm}
                  onSubmit={e => {
                    e.preventDefault();
                    if (reply.trim()) {
                      void sendReply();
                    } else {
                      void sendReply("👍");
                    }
                  }}
                >
                  <input
                    type="text"
                    className={styles.replyInput}
                    placeholder="Aa"
                    aria-label="Nhập tin nhắn phản hồi khách hàng"
                    value={reply}
                    maxLength={1500}
                    onChange={e => setReply(e.target.value)}
                  />
                  {reply.trim() ? (
                    <button
                      type="submit"
                      className={styles.replySendBtn}
                      aria-label="Gửi phản hồi"
                      disabled={sending}
                    >
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className={styles.replySendBtn}
                      aria-label="Gửi lượt thích"
                      disabled={sending}
                    >
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11Zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66a4.8 4.8 0 0 0-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15Z" />
                      </svg>
                    </button>
                  )}
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
