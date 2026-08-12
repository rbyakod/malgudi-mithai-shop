// Theme tokens shared between server (cookie read) and client (switcher).
// Keep this module side-effect-free — imported by both RSC and client components.

export const ADMIN_THEMES = [
  "mishran-admin",
  "mishran-midnight",
  "mishran-monsoon",
] as const;

export type AdminTheme = (typeof ADMIN_THEMES)[number];

export const DEFAULT_ADMIN_THEME: AdminTheme = "mishran-admin";

export const ADMIN_THEME_COOKIE = "mishran-admin-theme";

// 1 year in seconds.
export const ADMIN_THEME_MAX_AGE = 60 * 60 * 24 * 365;

export function isAdminTheme(value: unknown): value is AdminTheme {
  return typeof value === "string"
    && (ADMIN_THEMES as readonly string[]).includes(value);
}

export function parseAdminTheme(value: unknown): AdminTheme {
  return isAdminTheme(value) ? value : DEFAULT_ADMIN_THEME;
}

type CookieStoreLike = {
  get(name: string): string | undefined;
};

export function getAdminThemeFromCookies(store: CookieStoreLike): AdminTheme {
  return parseAdminTheme(store.get(ADMIN_THEME_COOKIE));
}
