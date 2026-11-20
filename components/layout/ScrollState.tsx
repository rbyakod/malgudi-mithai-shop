// components/layout/ScrollState.tsx
// Marks <html data-scrolling> while the visitor scrolls down, and clears it a second after
// they stop or as soon as they scroll up. The AI team's theme (mishran-agents data/theme.css)
// uses it to shrink its phone launcher bar to a circle so it never sits over what is being read.
// Renders nothing; one passive scroll listener.
"use client";

import {useEffect} from "react";

const SETTLE_MS = 1000;

export function ScrollState() {
  useEffect(() => {
    const root = document.documentElement;
    let lastY = window.scrollY;
    let timer = 0;
    const clear = () => {
      window.clearTimeout(timer);
      delete root.dataset.scrolling;
    };
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      if (delta < 0) {
        clear(); // scrolling up: show the full bar again straight away
        return;
      }
      if (delta === 0) return;
      root.dataset.scrolling = "down";
      window.clearTimeout(timer);
      timer = window.setTimeout(clear, SETTLE_MS);
    };
    window.addEventListener("scroll", onScroll, {passive: true});
    return () => {
      window.removeEventListener("scroll", onScroll);
      clear();
    };
  }, []);
  return null;
}

export default ScrollState;
