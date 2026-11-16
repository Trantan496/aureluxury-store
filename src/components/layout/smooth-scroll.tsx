"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

export function SmoothScroll() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const historyNavigation = useRef(false);
  const scrollerRef = useRef<Lenis | null>(null);

  useLayoutEffect(() => {
    const changed = previousPath.current !== pathname;
    previousPath.current = pathname;
    const restoreHistory = historyNavigation.current;
    historyNavigation.current = false;
    if (!changed || restoreHistory || !/^\/products\/[^/]+\/?$/.test(pathname) || window.location.hash) return;

    // Reset Lenis's animation target as well as the native scroll position.
    // Otherwise an in-flight wheel animation can move the new page down again.
    if (scrollerRef.current) scrollerRef.current.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let scroller: Lenis | null = null;

    const configure = () => {
      scroller?.destroy();
      scroller = null;
      scrollerRef.current = null;
      if (reducedMotion.matches) return;

      scroller = new Lenis({
        autoRaf: true,
        duration: 1.2,
        smoothWheel: true,
        wheelMultiplier: 0.8,
        syncTouch: false,
        anchors: { offset: -80 },
        allowNestedScroll: true,
      });
      scrollerRef.current = scroller;
    };

    configure();
    const onPopState = () => { historyNavigation.current = previousPath.current !== window.location.pathname; };
    window.addEventListener("popstate", onPopState);
    reducedMotion.addEventListener("change", configure);
    return () => {
      reducedMotion.removeEventListener("change", configure);
      scroller?.destroy();
      scrollerRef.current = null;
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return null;
}
