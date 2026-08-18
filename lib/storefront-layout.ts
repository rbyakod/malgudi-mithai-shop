export const STOREFRONT_LAYOUT_MODES = ["fixed", "full"] as const;
export const THEME_SWITCHER_VISIBILITIES = ["disabled", "home", "all"] as const;
export const HERO_STYLES = ["framed", "cinematic"] as const;

export type StorefrontLayoutMode = (typeof STOREFRONT_LAYOUT_MODES)[number];
export type ThemeSwitcherVisibility =
  (typeof THEME_SWITCHER_VISIBILITIES)[number];
export type HeroStyle = (typeof HERO_STYLES)[number];

export const DEFAULT_STOREFRONT_LAYOUT_MODE: StorefrontLayoutMode = "fixed";
export const DEFAULT_HERO_STYLE: HeroStyle = "framed";
export const DEFAULT_PRODUCT_IMAGE_MOTION = true;
export const DEFAULT_THEME_SWITCHER_VISIBILITY: ThemeSwitcherVisibility =
  "disabled";
export const DEFAULT_CATALOG_PAGE_SIZE = 100;
export const MIN_CATALOG_PAGE_SIZE = 12;
export const MAX_CATALOG_PAGE_SIZE = 120;

export function isFullWidthLayout(mode: StorefrontLayoutMode): boolean {
  return mode === "full";
}

export function normalizeHeroStyle(value: unknown): HeroStyle {
  return HERO_STYLES.includes(value as HeroStyle)
    ? (value as HeroStyle)
    : DEFAULT_HERO_STYLE;
}

export function normalizeThemeSwitcherVisibility(
  value: unknown,
): ThemeSwitcherVisibility {
  return THEME_SWITCHER_VISIBILITIES.includes(
    value as ThemeSwitcherVisibility,
  )
    ? (value as ThemeSwitcherVisibility)
    : DEFAULT_THEME_SWITCHER_VISIBILITY;
}

export function normalizeCatalogPageSize(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return DEFAULT_CATALOG_PAGE_SIZE;
  }

  return Math.min(
    MAX_CATALOG_PAGE_SIZE,
    Math.max(MIN_CATALOG_PAGE_SIZE, Math.round(parsed)),
  );
}
