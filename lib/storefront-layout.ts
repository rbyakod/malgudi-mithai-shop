export const STOREFRONT_LAYOUT_MODES = ["fixed", "full"] as const;

export type StorefrontLayoutMode = (typeof STOREFRONT_LAYOUT_MODES)[number];

export const DEFAULT_STOREFRONT_LAYOUT_MODE: StorefrontLayoutMode = "fixed";

export function isFullWidthLayout(mode: StorefrontLayoutMode): boolean {
  return mode === "full";
}
