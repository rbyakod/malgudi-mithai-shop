// lib/web/serviceability.ts
// Delivery-serviceability lookup shared by the PDP pincode check
// (components/mithai/PincodeCheck.tsx), the account address book, and the
// upcoming checkout flow. Extracted verbatim from PincodeCheck's fetch so
// every surface interprets the response identically.
//
// GET /api/mobile/v1/catalog/serviceable?pincode=NNNNNN → {data} envelope:
//   {serviceable, tier: "fresh"|"shelf", city, slaDays}
// 422 → the pincode format itself is invalid; 200 + serviceable:false →
// valid pincode outside our delivery zones.

export type ServiceabilityTier = "fresh" | "shelf";

export type ServiceabilityResult =
  | {kind: "ok"; pincode: string; tier: ServiceabilityTier; city: string; slaDays: number}
  | {kind: "notServiceable"; pincode: string}
  | {kind: "invalid"}
  | {kind: "error"};

export const PINCODE_RE = /^[0-9]{6}$/;

export async function checkServiceability(
  pincode: string,
  signal?: AbortSignal,
): Promise<ServiceabilityResult> {
  try {
    const res = await fetch(
      `/api/mobile/v1/catalog/serviceable?pincode=${encodeURIComponent(pincode)}`,
      {signal},
    );
    if (res.status === 422) return {kind: "invalid"};
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      data?: {
        serviceable?: boolean;
        tier?: ServiceabilityTier;
        city?: string;
        slaDays?: number;
      };
    };
    const d = body.data;
    if (
      d?.serviceable &&
      (d.tier === "fresh" || d.tier === "shelf") &&
      d.city &&
      typeof d.slaDays === "number"
    ) {
      return {kind: "ok", pincode, tier: d.tier, city: d.city, slaDays: d.slaDays};
    }
    return {kind: "notServiceable", pincode};
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return {kind: "error"};
  }
}
