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

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  try {
    const domTheme = normalizeTheme(
      document.documentElement.getAttribute("data-theme")
    );
    if (domTheme && VALID_THEMES.includes(domTheme)) {
      return domTheme;
    }

    const storedTheme = normalizeTheme(localStorage.getItem(STORAGE_KEY));
    if (storedTheme && VALID_THEMES.includes(storedTheme)) {
      return storedTheme;
    }
  } catch {
    // ignore
  }

  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    const syncedTheme = getInitialTheme();
    if (syncedTheme !== theme) {
      setThemeState(syncedTheme);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
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
