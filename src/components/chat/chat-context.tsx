"use client";

import { MotionPanel } from "@/components/ui/motion-panel";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ChatPanel } from "./chat-panel";
import styles from "./chat.module.css";

type ChatContextValue = {
  drawerOpen: boolean;
  redirecting: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  handleIconClick: () => void;
  handleIconDoubleClick: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

const DOUBLE_CLICK_WINDOW_MS = 260;

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSession, setDrawerSession] = useState(0);

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const isDrawerVisible = drawerOpen && !pathname.startsWith("/messages");

  // Close drawer on Escape key
  useEffect(() => {
    if (!isDrawerVisible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        clearTimers();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDrawerVisible, clearTimers]);

  const startRedirectFlow = useCallback(() => {
    clearTimers();
    setDrawerOpen(false);
    router.push("/messages/connecting");
  }, [clearTimers, router]);

  const openDrawer = useCallback(() => {
    clearTimers();
    setDrawerSession(value => value + 1);
    setDrawerOpen(true);
  }, [clearTimers]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleIconClick = useCallback(() => {
    const isMobile =
      typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

    // On mobile phones: navigate directly to the messages page immediately
    if (isMobile) {
      clearTimers();
      setDrawerOpen(false);
      router.push("/messages");
      return;
    }

    // Already on /messages or /messages/connecting: no need to redirect again
    if (pathname.startsWith("/messages")) {
      return;
    }

    // Laptop/Desktop: distinguish single click vs double click
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      openDrawer();
      return;
    }

    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      startRedirectFlow();
    }, DOUBLE_CLICK_WINDOW_MS);
  }, [clearTimers, openDrawer, pathname, router, startRedirectFlow]);

  const handleIconDoubleClick = useCallback(() => {
    const isMobile =
      typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) return;
    openDrawer();
  }, [openDrawer]);

  return (
    <ChatContext.Provider
      value={{
        drawerOpen: isDrawerVisible,
        redirecting: pathname === "/messages/connecting",
        openDrawer,
        closeDrawer,
        handleIconClick,
        handleIconDoubleClick,
      }}
    >
      {children}

      <MotionPanel open={isDrawerVisible} as="aside" kind="drawer" className={styles.drawer}
          role="dialog"
          aria-label="Hộp thoại nhắn tin với AUREL">
          <ChatPanel key={drawerSession} variant="drawer" preferredChannel="BOT" onClose={closeDrawer} />
        </MotionPanel>
    </ChatContext.Provider>
  );
}

export function useOptionalChat() {
  return useContext(ChatContext);
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return ctx;
}
