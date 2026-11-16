"use client";

import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from "react";

type MotionPanelProps = HTMLAttributes<HTMLElement> & {
  open: boolean;
  as?: "div" | "aside";
  kind?: "popover" | "drawer";
};

/** CSS owns motion; presence lasts only until the actual exit transitions finish. */
export function MotionPanel({ open, as = "div", kind = "popover", className, children, ...props }: MotionPanelProps) {
  const [retained, setRetained] = useState(open);
  const [initialOpen] = useState(open);
  const element = useRef<HTMLElement>(null);
  const captureElement = useCallback((node: HTMLElement | null) => { element.current = node; }, []);
  if (open && !retained) setRetained(true);

  useEffect(() => {
    if (open || !retained) return;
    let cancelled = false;
    const animations = element.current?.getAnimations?.() ?? [];
    void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (!cancelled) setRetained(false);
    });
    return () => { cancelled = true; };
  }, [open, retained]);

  useEffect(() => {
    if (!open || kind !== "drawer") return;
    const previous = document.activeElement;
    const node = element.current;
    node?.querySelector<HTMLElement>("button, a[href], input, [tabindex='0']")?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected &&
        (document.activeElement === document.body || node?.contains(document.activeElement))) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, kind]);

  if (!open && !retained) return null;
  const attributes = {
    ...props,
    className: `aurel-motion-panel ${className ?? ""}`,
    "data-state": open ? "open" : "closed",
    "data-motion-kind": kind,
    "data-initial-open": initialOpen ? "" : undefined,
    inert: !open,
    "aria-hidden": !open ? true : undefined,
  };
  return as === "aside"
    ? <aside {...attributes} ref={captureElement}>{children}</aside>
    : <div {...attributes} ref={captureElement}>{children}</div>;
}
