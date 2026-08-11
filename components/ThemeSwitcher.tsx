"use client";

import {useEffect, useRef, useState} from "react";
import {useTheme} from "@/context/ThemeContext";
import {
  getThemeDefinition,
  THEME_GROUP_ORDER,
  THEMES,
  Theme
} from "@/lib/themes";
import {track} from "@/lib/analytics";

const THEME_GROUPS = THEME_GROUP_ORDER.map((group) => ({
  group,
  themes: THEMES.filter((theme) => theme.group === group)
}));

export function ThemeSwitcher({className = ""}: {className?: string}) {
  const {theme, setTheme} = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTheme = getThemeDefinition(theme);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleThemeSelect = (nextTheme: Theme) => {
    setTheme(nextTheme);
    track("theme_changed", {theme: nextTheme});
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={["theme-switcher", "relative", className].join(" ").trim()}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="theme-switcher__trigger group flex w-full min-w-0 items-center gap-3 rounded-2xl border border-border-input bg-bg-card/88 px-3 py-2 text-left text-text-secondary shadow-sm backdrop-blur transition hover:border-primary/60 hover:bg-bg-card md:min-w-[15rem]"
      >
        <div className="min-w-0 flex-1">
          <span className="theme-switcher__eyebrow hidden truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted sm:block">
            Design System
          </span>
          <span className="theme-switcher__label block truncate text-sm font-semibold text-text-heading sm:mt-0.5">
            {activeTheme.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {[
            activeTheme.preview.canvas,
            activeTheme.preview.surface,
            activeTheme.preview.accent,
            activeTheme.preview.pop
          ].map((color) => (
            <span
              key={color}
              className="h-3.5 w-3.5 rounded-full border border-white/20 shadow-sm sm:h-4 sm:w-4"
              style={{backgroundColor: color}}
            />
          ))}
        </div>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Theme studio"
          className="theme-switcher__panel absolute left-1/2 top-[calc(100%+0.75rem)] z-40 w-[min(94vw,36rem)] -translate-x-1/2 overflow-hidden rounded-[1.5rem] border border-border-card bg-bg-card/96 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl md:left-auto md:right-0 md:w-[min(92vw,36rem)] md:translate-x-0 md:rounded-[1.75rem]"
        >
          <div className="border-b border-border-card bg-bg-page/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              Theme Studio
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Switch the live token set across house themes and design-system variants.
            </p>
          </div>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-3 sm:p-4">
            {THEME_GROUPS.map(({group, themes}) => (
              <section key={group} className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  {group}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {themes.map((entry) => {
                    const isActive = entry.id === theme;

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => handleThemeSelect(entry.id)}
                        className={`group relative overflow-hidden rounded-3xl border p-3 text-left transition ${
                          isActive
                            ? "border-primary bg-bg-accent/70 shadow-[0_16px_42px_rgba(0,0,0,0.18)]"
                            : "border-border-card bg-bg-page/45 hover:-translate-y-0.5 hover:border-primary/55 hover:bg-bg-accent/55"
                        }`}
                      >
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 opacity-95"
                          style={{
                            background: `linear-gradient(140deg, ${entry.preview.canvas} 0%, ${entry.preview.surface} 58%, ${entry.preview.accent} 100%)`
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />

                        <div className="relative flex min-h-[11rem] flex-col justify-between">
                          <div className="flex items-start justify-between gap-3">
                            <span
                              className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                              style={{
                                borderColor: `${entry.preview.ink}2e`,
                                backgroundColor: `${entry.preview.surface}d9`,
                                color: entry.preview.ink
                              }}
                            >
                              House
                            </span>

                            {isActive ? (
                              <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-light">
                                Live
                              </span>
                            ) : null}
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              {[
                                entry.preview.canvas,
                                entry.preview.surface,
                                entry.preview.accent,
                                entry.preview.pop
                              ].map((color) => (
                                <span
                                  key={`${entry.id}-${color}`}
                                  className="h-5 w-5 rounded-full border shadow-sm"
                                  style={{
                                    backgroundColor: color,
                                    borderColor: `${entry.preview.ink}26`
                                  }}
                                />
                              ))}
                            </div>

                            <div>
                              <h3
                                className="text-base font-semibold"
                                style={{color: entry.preview.ink}}
                              >
                                {entry.label}
                              </h3>
                              <p
                                className="mt-1 text-xs leading-relaxed"
                                style={{color: `${entry.preview.ink}d9`}}
                              >
                                {entry.blurb}
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <span
                                className="text-[11px] font-medium"
                                style={{color: `${entry.preview.ink}c4`}}
                              >
                                {entry.source}
                              </span>
                              <span
                                className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                                style={{
                                  backgroundColor: entry.preview.pop,
                                  color: "#08111f"
                                }}
                              >
                                {isActive ? "Selected" : "Switch"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
