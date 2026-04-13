"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  normalizeTheme,
  Theme,
  VALID_THEMES,
} from "@/lib/themes";

const STORAGE_KEY = "mithai-theme";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
} | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const normalized = normalizeTheme(stored);
      if (normalized && VALID_THEMES.includes(normalized)) {
        setThemeState(normalized);
        document.documentElement.setAttribute("data-theme", normalized);
        if (stored !== normalized) {
          localStorage.setItem(STORAGE_KEY, normalized);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
