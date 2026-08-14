// lib/loyalty/eligibility.ts
// Apple Wallet loyalty-pass eligibility — Task 19.1.
//
// Pure tier-resolution logic shared by:
//   - GET /account/loyalty-pass (on-demand pass generation)
//   - OrderEventEmitter (proactive Silver pass on the 2nd delivered order)
//
// Tiers (spec §19): Silver at ≥2 delivered orders, Gold at ≥5. Below 2 the
// customer is not eligible (the route returns 404). The serial number is
// stable per customer so repeat requests reuse the same WalletPasses row
// rather than minting duplicate passes.

import type { LoyaltyTier } from "../wallet/WalletPassService";

export const LOYALTY_SILVER_MIN_DELIVERED = 2;
export const LOYALTY_GOLD_MIN_DELIVERED = 5;

/**
 * Resolve the loyalty tier from a customer's delivered-order count.
 * Returns null when the customer has not yet qualified.
 */
export function tierForDeliveredCount(deliveredCount: number): LoyaltyTier | null {
  if (deliveredCount >= LOYALTY_GOLD_MIN_DELIVERED) return "gold";
  if (deliveredCount >= LOYALTY_SILVER_MIN_DELIVERED) return "silver";
  return null;
}

/**
 * Stable per-customer pass serial number. Idempotent across requests — the
 * WalletPasses row is keyed by customerId so a repeat /loyalty-pass call
 * reuses the same serial + regenerates only the (24h-expiring) signed URL.
 */
export function loyaltySerialNumber(customerId: string): string {
  return `mishran-loyalty-${customerId}`;
}
