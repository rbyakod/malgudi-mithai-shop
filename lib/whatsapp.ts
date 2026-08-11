// lib/whatsapp.ts
// Shared WhatsApp helpers. Centralizes the static fallback number and the
// digit-normalization transform so BrandBar / SiteFooter / CommerceStub /
// CartItems don't each carry their own copy.
//
// The fallback number is the same placeholder that the legacy footer
// hard-coded; it is overridden in production by Payload's
// `analytics-settings.whatsappNumber` global.

/**
 * Static fallback when the Payload global is missing or empty.
 * Canonical value — keep in sync across all consumers via this single export.
 */
export const FALLBACK_WHATSAPP = "+91-98765-43210";

/**
 * Normalize a WhatsApp number string to digits only.
 * `+91-98765-43210` → `919876543210`. Empty/invalid input → empty string.
 *
 * Used to build wa.me deep links (which require digits only, no `+` or
 * punctuation).
 */
export function toWaDigits(input: string): string {
  if (!input) return "";
  return input.replace(/[^\d]/g, "");
}
