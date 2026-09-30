// lib/store-info.ts
// The main store, read from the admin's Store Settings (04 Storefront / 05 Settings → Store Settings).
// The footer, the top brand bar, the contact page and the search-engine (JSON-LD) data all read it here, so the
// address and city are entered once in the admin and never hard-coded in copy. The first store in the list is the
// main one. Missing or empty means "not set": callers then leave the city and address out rather than invent one.
import {getPayload} from "@/lib/payload-client";

export interface StoreInfo {
  name: string;
  city: string;
  state: string;
  postalCode: string;
  /** Street and area, without the city, state or postcode. */
  address: string;
  /** Opening hours as the owner wrote them; empty when none are published. */
  hours: string;
}

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Pure: picks the first store that says where it is. */
export function primaryStoreFrom(global: unknown): StoreInfo | null {
  const stores = (global as {stores?: unknown} | null | undefined)?.stores;
  if (!Array.isArray(stores)) return null;
  for (const raw of stores) {
    const s = (raw ?? {}) as Record<string, unknown>;
    const info: StoreInfo = {
      name: text(s.name),
      city: text(s.city),
      state: text(s.state),
      postalCode: text(s.postalCode),
      address: text(s.address),
      hours: text(s.hours),
    };
    if (info.city || info.address) return info;
  }
  return null;
}

/** One line for a customer: "Main Market, H-4/3, Model Town, Delhi, Delhi 110009". Parts that are empty are left out. */
export function fullAddress(store: StoreInfo): string {
  const region = [store.state, store.postalCode].filter(Boolean).join(" ");
  return [store.address, store.city, region].filter(Boolean).join(", ");
}

// Best-effort Payload read: null on any error so the layout stays up during builds, migrations or DB outages.
export async function getPrimaryStore(): Promise<StoreInfo | null> {
  try {
    const payload = await getPayload();
    return primaryStoreFrom(await payload.findGlobal({slug: "store-settings"}));
  } catch {
    return null;
  }
}
