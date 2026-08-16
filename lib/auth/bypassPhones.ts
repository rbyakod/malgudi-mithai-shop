// lib/auth/bypassPhones.ts
// Test login seam (temporary) — the phone allow-list behind OTP_BYPASS_PHONE.
//
// The VPS has no real MSG91 keys, so listed numbers skip the SMS provider
// entirely and verify with the fixed OTP_BYPASS_CODE instead of the hashed
// random code (see the otp/send + otp/verify routes). Family distribution
// needs several testers, so the env var holds a COMMA-SEPARATED list:
//
//   OTP_BYPASS_PHONE="+918088983014,+919812345678"
//
// Absent/empty env -> empty list -> the seam is fully disabled and every
// phone goes through the real provider path. Unset the env vars to delete
// the seam.

/** Parse a comma-separated phone list; trims whitespace, drops empty entries. */
export function parseBypassPhones(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** True when the phone is in the OTP_BYPASS_PHONE allow-list. */
export function isBypassPhone(phone: string, raw: string | undefined = process.env.OTP_BYPASS_PHONE): boolean {
  return parseBypassPhones(raw).includes(phone);
}
