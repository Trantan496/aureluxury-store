"use client";

import { useEffect } from "react";

/** Retains the browser's dialog focus/escape behavior during native CSS exits. */
export function MotionPreferences() {
  useEffect(() => {
    if (!("onbeforetoggle" in document.createElement("dialog")) ||
      !CSS.supports("transition-behavior", "allow-discrete")) return;

    const owned = new WeakMap<HTMLDialogElement, { inert: boolean; preventScroll: boolean }>();
    const sync = (dialog: HTMLDialogElement, open: boolean) => {
      if (!owned.has(dialog)) {
        // Leave explicitly inert application dialogs under their owner's control.
        if (dialog.inert) return;
        owned.set(dialog, { inert: dialog.inert, preventScroll: dialog.hasAttribute("data-lenis-prevent") });
      }
      dialog.inert = !open;
      // The dialog scrolls natively while the backdrop cannot drive Lenis.
      dialog.setAttribute("data-lenis-prevent", "");
    };
    const beforeToggle = (event: Event) => {
      if (event.target instanceof HTMLDialogElement) {
        sync(event.target, (event as ToggleEvent).newState === "open");
      }
    };
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.target instanceof HTMLDialogElement) sync(record.target, record.target.open);
      }
    });
    document.addEventListener("beforetoggle", beforeToggle, true);
    observer.observe(document.body, { attributes: true, attributeFilter: ["open"], subtree: true });
    document.documentElement.dataset.nativeDialogMotion = "true";
    return () => {
      document.removeEventListener("beforetoggle", beforeToggle, true);
      observer.disconnect();
      delete document.documentElement.dataset.nativeDialogMotion;
      for (const dialog of document.querySelectorAll("dialog")) {
        const initial = owned.get(dialog);
        if (!initial) continue;
        dialog.inert = initial.inert;
        if (!initial.preventScroll) dialog.removeAttribute("data-lenis-prevent");
      }
    };
  }, []);
  return null;
}
