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

function readClientTheme(): Theme {
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
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    // First client render must match SSR. Adopt the boot-script/localStorage
    // theme only after hydration to avoid ThemeSwitcher text mismatches.
    const clientTheme = readClientTheme();
    if (clientTheme !== theme) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration sync after matching SSR
      setThemeState(clientTheme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot hydration sync
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
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
