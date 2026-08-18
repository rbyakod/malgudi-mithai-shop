import {getPayload} from "@/lib/payload-client";
import {
  DEFAULT_PRODUCT_IMAGE_MOTION,
  DEFAULT_STOREFRONT_LAYOUT_MODE,
  DEFAULT_THEME_SWITCHER_VISIBILITY,
  normalizeCatalogPageSize,
  normalizeHeroStyle,
  normalizeThemeSwitcherVisibility,
  type HeroStyle,
  type StorefrontLayoutMode,
  type ThemeSwitcherVisibility,
} from "@/lib/storefront-layout";

export async function readStorefrontLayoutMode(): Promise<StorefrontLayoutMode> {
  try {
    const payload = await getPayload();
    const global = await payload.findGlobal({slug: "theme-settings"});
    const value = (global as {storefrontLayoutMode?: unknown}).storefrontLayoutMode;
    return value === "full" ? "full" : DEFAULT_STOREFRONT_LAYOUT_MODE;
  } catch {
    return DEFAULT_STOREFRONT_LAYOUT_MODE;
  }
}

export async function readHeroStyle(): Promise<HeroStyle> {
  try {
    const payload = await getPayload();
    const global = await payload.findGlobal({slug: "theme-settings"});
    return normalizeHeroStyle((global as {heroStyle?: unknown}).heroStyle);
  } catch {
    return normalizeHeroStyle(null);
  }
}

export async function readProductImageMotion(): Promise<boolean> {
  try {
    const payload = await getPayload();
    const global = await payload.findGlobal({slug: "theme-settings"});
    return (global as {productImageMotion?: unknown}).productImageMotion === false
      ? false
      : DEFAULT_PRODUCT_IMAGE_MOTION;
  } catch {
    return DEFAULT_PRODUCT_IMAGE_MOTION;
  }
}

export async function readThemeSwitcherVisibility(): Promise<ThemeSwitcherVisibility> {
  if (process.env.NEXT_PUBLIC_ENABLE_THEME_SWITCHER === "true") {
    return "all";
  }

  try {
    const payload = await getPayload();
    const global = await payload.findGlobal({slug: "theme-settings"});
    const visibility = normalizeThemeSwitcherVisibility(
      (global as {themeSwitcherVisibility?: unknown}).themeSwitcherVisibility,
    );

    if (visibility !== DEFAULT_THEME_SWITCHER_VISIBILITY) {
      return visibility;
    }

    return (global as {showThemeSwitcher?: unknown}).showThemeSwitcher === true
      ? "all"
      : DEFAULT_THEME_SWITCHER_VISIBILITY;
  } catch {
    return DEFAULT_THEME_SWITCHER_VISIBILITY;
  }
}

export async function readThemeSwitcherEnabled(): Promise<boolean> {
  return (await readThemeSwitcherVisibility()) !== "disabled";
}

export async function readCatalogPageSize(): Promise<number> {
  try {
    const payload = await getPayload();
    const global = await payload.findGlobal({slug: "theme-settings"});
    return normalizeCatalogPageSize(
      (global as {catalogPageSize?: unknown}).catalogPageSize,
    );
  } catch {
    return normalizeCatalogPageSize(null);
  }
}
