import {getPayload} from "@/lib/payload-client";
import {
  DEFAULT_STOREFRONT_LAYOUT_MODE,
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
