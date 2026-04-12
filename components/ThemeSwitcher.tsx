"use client";

import { useTheme, Theme } from "@/context/ThemeContext";

const THEMES: { id: Theme; label: string }[] = [
  { id: "festive", label: "Festive Saffron" },
  { id: "navy", label: "Evening Navy" },
  { id: "sage", label: "Minimal Sage" },
  { id: "mindbox", label: "MindBox" },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <select
      className="rounded-full border border-border-input bg-bg-card px-2 py-1 text-xs text-text-secondary"
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      aria-label="Color theme"
    >
      {THEMES.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
