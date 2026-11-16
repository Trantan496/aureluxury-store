"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Animate only the newly received reply; polling/history never replays it. */
export function ReplyText({ text: rawText, animate, messageId, onComplete }: {
  text: string; animate: boolean; messageId?: string; onComplete?: (id: string) => void;
}) {
  const text = rawText.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
  const span = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(animate ? "" : text);
  const follow = useRef(false);
  useLayoutEffect(() => {
    const log = span.current?.closest<HTMLElement>('[role="log"]');
    if (log && follow.current) log.scrollTop = log.scrollHeight;
  }, [visible]);
  useEffect(() => {
    const node = span.current;
    if (!node || !animate) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const characters = Array.from(text);
    const duration = Math.min(6500, Math.max(900, characters.length * 26));
    const log = node.closest<HTMLElement>('[role="log"]');
    let frame = 0;
    let start: number | undefined;
    const finish = () => { cancelAnimationFrame(frame); setVisible(text); if (messageId) onComplete?.(messageId); };
    const tick = (time: number) => {
      start ??= time;
      if (preference.matches) { finish(); return; }
      follow.current = Boolean(log && log.scrollHeight - log.scrollTop - log.clientHeight < 64);
      const raw = Math.min(1, (time - start) / duration);
      const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
      setVisible(characters.slice(0, Math.ceil(characters.length * eased)).join(""));
      if (raw < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    preference.addEventListener("change", finish);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); preference.removeEventListener("change", finish); };
  }, [animate, text, messageId, onComplete]);
  return <span role="text" aria-label={text}><span ref={span} aria-hidden="true">{animate ? visible : text}</span></span>;
}
