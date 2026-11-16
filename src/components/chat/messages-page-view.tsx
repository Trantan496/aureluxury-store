"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  sortCustomerThreads,
  type ChatConversation,
  type ChatConversationSummary,
  type ChatThreadChannel,
} from "@/features/chat/types";
import { AurelLogoAvatar, ChatPanel, type ChatPanelHandle } from "./chat-panel";
import styles from "./chat.module.css";

const INITIAL_DEFAULT_THREADS: ChatConversationSummary[] = [
  {
    id: "__default_staff__",
    participantKey: "",
    userId: null,
    customerName: "Khách truy cập",
    customerEmail: null,
    channel: "STAFF",
    title: "Nhân viên AUREL",
    pinned: true,
    isDefault: true,
    hasStarted: false,
    botReplyCount: 0,
    mode: "WAITING_STAFF",
    status: "OPEN",
    unreadByStaff: 0,
    unreadByCustomer: 0,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
    lastMessagePreview: "Nhắn trực tiếp với nhân viên tư vấn",
    messageCount: 0,
  },
  {
    id: "__default_bot__",
    participantKey: "",
    userId: null,
    customerName: "Khách truy cập",
    customerEmail: null,
    channel: "BOT",
    title: "AUREL Concierge Bot",
    pinned: false,
    isDefault: true,
    hasStarted: false,
    botReplyCount: 0,
    mode: "BOT",
    status: "OPEN",
    unreadByStaff: 0,
    unreadByCustomer: 0,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
    lastMessagePreview: "Trợ lý AI tìm sản phẩm & tư vấn size",
    messageCount: 0,
  },
];

function isPlaceholderId(id: string | null) {
  return !id || id.startsWith("__default_");
}

export function MessagesPageView() {
  const chatRef = useRef<ChatPanelHandle>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const [threads, setThreads] = useState<ChatConversationSummary[]>(INITIAL_DEFAULT_THREADS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  useEffect(() => {
    if (!createMenuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setCreateMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [createMenuOpen]);

  const handleStateChange = useCallback(
    (payload: {
      conversation: ChatConversation;
      conversations: ChatConversationSummary[];
    }) => {
      setThreads(sortCustomerThreads(payload.conversations));
      setSelectedId(payload.conversation.id);
    },
    [],
  );

  const handleCreateThread = async (channel: ChatThreadChannel) => {
    setCreateMenuOpen(false);
    await chatRef.current?.create(channel);
  };

  const sortedThreads = sortCustomerThreads(threads);
  const filteredThreads = sortedThreads.filter(item => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.lastMessagePreview.toLowerCase().includes(q) ||
      (item.channel === "STAFF" ? "nhân viên aurel" : "bot trợ lý ai").includes(q)
    );
  });

  const activeThreadId = !isPlaceholderId(selectedId)
    ? selectedId
    : sortedThreads.find(t => t.channel === "BOT")?.id ?? sortedThreads[0]?.id ?? null;

  return (
    <section className={styles.messengerShell} aria-label="Phòng tư vấn và nhắn tin AUREL">
      {/* Column 1: Left Espresso Navigation Rail */}
      <nav className={styles.messengerRail} aria-label="Điều hướng phòng tư vấn">
        <div className={styles.railGroup}>
          <Link
            href="/messages"
            className={`${styles.railBtn} ${styles.railBtnActive}`}
            aria-current="page"
            title="Đoạn chat"
            aria-label="Đoạn chat"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path
                d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
              <circle cx="12.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
            </svg>
          </Link>
          <Link
            href="/products?page=1"
            className={styles.railBtn}
            title="Cửa hàng AUREL"
            aria-label="Cửa hàng sản phẩm"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M6 7h12l1 13H5L6 7Z" strokeLinejoin="round" />
              <path d="M9 7a3 3 0 0 1 6 0" strokeLinecap="round" />
            </svg>
          </Link>
          <Link
            href="/account/orders"
            className={styles.railBtn}
            title="Đơn hàng của tôi"
            aria-label="Đơn hàng của tôi"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 10h18M8 15h5" strokeLinecap="round" />
            </svg>
          </Link>
          <Link
            href="/favorites"
            className={styles.railBtn}
            title="Sản phẩm yêu thích"
            aria-label="Sản phẩm yêu thích"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path
                d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>

        <div className={styles.railGroup}>
          <Link
            href="/"
            className={styles.railBtn}
            title="Về trang chủ AUREL"
            aria-label="Về trang chủ AUREL"
          >
            <span className={styles.railBrandMonogram}>A</span>
          </Link>
        </div>
      </nav>

      {/* Column 2: Editorial Thread Sidebar */}
      <aside className={styles.messengerSidebar} aria-label="Danh sách đoạn chat">
        <div className={styles.sidebarBrand}>
          <p className={styles.sidebarBrandName}>AUREL</p>
          <p className={styles.sidebarBrandTag}>FASHION CONCIERGE</p>
        </div>

        <div className={styles.sidebarHeader} ref={createMenuRef}>
          <h1 className={styles.sidebarTitle}>Đoạn chat</h1>
          <div className={styles.headerMenuWrap}>
            <button
              type="button"
              className={styles.sidebarCircleBtn}
              title="Tạo đoạn chat mới"
              aria-label="Tạo đoạn chat mới"
              aria-expanded={createMenuOpen}
              onClick={() => setCreateMenuOpen(prev => !prev)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>

            {createMenuOpen && (
              <div className={styles.headerMenu} role="menu" aria-label="Chọn loại đoạn chat mới">
                <button
                  type="button"
                  className={styles.headerMenuItem}
                  role="menuitem"
                  onClick={() => void handleCreateThread("BOT")}
                >
                  ✦ Chat mới với Bot AUREL
                </button>
                <button
                  type="button"
                  className={styles.headerMenuItem}
                  role="menuitem"
                  onClick={() => void handleCreateThread("STAFF")}
                >
                  📌 Chat mới với Nhân viên AUREL
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.sidebarSearchWrap}>
          <div className={styles.sidebarSearchBox}>
            <svg
              className={styles.sidebarSearchIcon}
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              className={styles.sidebarSearchInput}
              placeholder="Tìm kiếm hội thoại hoặc chủ đề..."
              aria-label="Tìm kiếm đoạn chat"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.threadList}>
          {filteredThreads.length === 0 ? (
            <p className={styles.threadEmptyNote}>Không tìm thấy đoạn chat phù hợp.</p>
          ) : (
            filteredThreads.map(item => {
              const isStaffThread = item.channel === "STAFF";
              const isPinned = item.pinned || isStaffThread;
              const isActive = item.id === activeThreadId;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.threadItem} ${isActive ? styles.threadItemActive : ""}`}
                  onClick={() => {
                    if (!isPlaceholderId(item.id)) {
                      setSelectedId(item.id);
                    }
                  }}
                >
                  <span
                    className={`${styles.avatarWrap} ${
                      isActive ? styles.avatarWrapOnDark : styles.avatarWrapShortcut
                    } ${isStaffThread ? "" : styles.avatarWrapLogo}`}
                    aria-hidden="true"
                  >
                    {isStaffThread ? "N" : <AurelLogoAvatar size={36} />}
                    <span
                      className={`${styles.onlineDot} ${
                        item.mode === "WAITING_STAFF" ? styles.onlineDotWaiting : ""
                      }`}
                    />
                  </span>
                  <div className={styles.threadText}>
                    <div className={styles.threadNameRow}>
                      <span className={styles.threadName}>{item.title}</span>
                      {isPinned ? (
                        <span
                          className={`${styles.threadBadge} ${
                            isActive ? styles.threadBadgeOnDark : styles.threadBadgePin
                          }`}
                          title="Đã ghim lên đầu"
                        >
                          Ghim
                        </span>
                      ) : (
                        <span
                          className={`${styles.threadBadge} ${
                            isActive ? styles.threadBadgeOnDark : ""
                          }`}
                        >
                          Bot
                        </span>
                      )}
                    </div>
                    <div className={styles.threadSubRow}>
                      <span className={styles.threadPreview}>{item.lastMessagePreview}</span>
                    </div>
                  </div>
                  {(item.unreadByCustomer ?? 0) > 0 && <span className={styles.unreadDot} />}
                  <svg
                    className={styles.threadChevron}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              );
            })
          )}

          <div className={styles.sidebarPromoCard}>
            <Image
              src="/images/aurel/account-editorial-still-life.png"
              alt=""
              width={200}
              height={240}
              className={styles.sidebarPromoBg}
              aria-hidden="true"
              unoptimized
            />
            <div className={styles.sidebarPromoContent}>
              <svg
                className={styles.sidebarPromoSparkle}
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2 14.4 9.6 22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z" />
              </svg>
              <p className={styles.sidebarPromoTitle}>Nhắn nhanh khi lướt web</p>
              <p className={styles.sidebarPromoDesc}>
                Trên laptop, click 2 lần vào icon tin nhắn trên thanh điều hướng để mở hộp thoại
                trò chuyện nhanh cùng Bot AUREL ngay bên phải màn hình.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Column 3: Main Editorial Concierge Window */}
      <div className={styles.messengerMain}>
        <ChatPanel
          variant="page"
          preferredChannel="BOT"
          conversationId={isPlaceholderId(selectedId) ? null : selectedId}
          chatRef={chatRef}
          onStateChange={handleStateChange}
        />
      </div>
    </section>
  );
}
