import {getPayload} from "@/lib/payload-client";
import {
  DEFAULT_STOREFRONT_LAYOUT_MODE,
  normalizeCatalogPageSize,
  type StorefrontLayoutMode,
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

export async function readThemeSwitcherEnabled(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_ENABLE_THEME_SWITCHER === "true") {
    return true;
  }

  try {
    const payload = await getPayload();
    const global = await payload.findGlobal({slug: "theme-settings"});
    return (global as {showThemeSwitcher?: unknown}).showThemeSwitcher === true;
  } catch {
    return false;
  }
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
