// SSR-safe subscription to prefers-reduced-motion. Returns false on the
// server and the first client render so the markup matches; re-renders
// with the real value once mounted.
"use client";

import {useEffect, useState} from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Setting state in useEffect is correct for SSR-safe hooks
    setReduced(mql.matches);
    const listener = (e: MediaQueryListEvent) => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Setting state in useEffect is correct for SSR-safe hooks
      setReduced(e.matches);
    };
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);

  return reduced;
}
