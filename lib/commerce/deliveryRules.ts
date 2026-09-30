// lib/commerce/deliveryRules.ts
// The delivery fee and free-delivery threshold for each pincode tier. The admin's "Delivery & fees" settings
// (06 Commerce) win when a value is entered; an empty field falls back to the server setting (lib/config.ts:
// DELIVERY_FEE_*_PAISE, FREE_DELIVERY_THRESHOLD_*_PAISE). Amounts are entered in rupees and used in paise.
//
// Every place that prices a cart reads the rules here (cart estimate, cart validate, the web cart, the shipping
// help page), so the website, the apps and the order snapshot always agree. The read is cached for a short time:
// a change in the admin reaches customers within about CACHE_MS.
import { config as appConfig, type Config } from "../config";
import { MAX_FEE_RUPEES, MAX_THRESHOLD_RUPEES, rupeesToPaiseWithin } from "./deliveryLimits";

export interface DeliveryRules {
  fees: { freshPaise: number; shelfStablePaise: number };
  freeThresholds: { freshPaise: number; shelfStablePaise: number };
}

export const CACHE_MS = 30_000;

type EnvRules = Pick<
  Config,
  | "deliveryFeeFreshPaise"
  | "deliveryFeeShelfStablePaise"
  | "freeDeliveryThresholdFreshPaise"
  | "freeDeliveryThresholdShelfStablePaise"
>;

/** Pure: admin value if it is a whole-rupee amount within the allowed range, otherwise the server value, field by field. */
export function resolveDeliveryRules(global: unknown, env: EnvRules = appConfig): DeliveryRules {
  const g = (global ?? {}) as Record<string, unknown>;
  return {
    fees: {
      freshPaise: rupeesToPaiseWithin(g.freshFee, MAX_FEE_RUPEES) ?? env.deliveryFeeFreshPaise,
      shelfStablePaise: rupeesToPaiseWithin(g.shelfStableFee, MAX_FEE_RUPEES) ?? env.deliveryFeeShelfStablePaise,
    },
    freeThresholds: {
      freshPaise: rupeesToPaiseWithin(g.freshFreeThreshold, MAX_THRESHOLD_RUPEES) ?? env.freeDeliveryThresholdFreshPaise,
      shelfStablePaise: rupeesToPaiseWithin(g.shelfStableFreeThreshold, MAX_THRESHOLD_RUPEES) ?? env.freeDeliveryThresholdShelfStablePaise,
    },
  };
}

let cache: { at: number; rules: DeliveryRules } | null = null;

export function clearDeliveryRulesCache(): void {
  cache = null;
}

/** Cached read of the admin settings, with the server values as the fallback. Never throws: a database problem
 *  must not stop checkout, so it falls back to the server values. */
export async function getDeliveryRules(now: number = Date.now()): Promise<DeliveryRules> {
  if (cache && now - cache.at < CACHE_MS) return cache.rules;
  let global: unknown = null;
  try {
    const { getPayload } = await import("payload");
    const { default: payloadConfig } = await import("../../payload.config");
    const payload = await getPayload({ config: payloadConfig });
    global = await payload.findGlobal({ slug: "delivery-settings" });
  } catch {
    global = null;
  }
  const rules = resolveDeliveryRules(global);
  cache = { at: now, rules };
  return rules;
}
