// lib/wallet/WalletPassService.ts
// Apple Wallet pass generation + storage adapter — Task 18.5.
//
// Produces signed `.pkpass` bundles for the loyalty pass (Task 19.1) and
// stores them with a time-limited signed URL the iOS client fetches and adds
// via PKAddPassesViewController.
//
// Adapter pattern: NodePassbookWalletService is the real impl (node:crypto
// PKCS#7 signature over a manifest + S3/MinIO upload); FakeWalletService is
// the in-memory fake for unit tests. Vendor swap (a different pass library or
// storage backend) is an impl change only.

export type LoyaltyTier = "silver" | "gold";

export interface WalletPassFields {
  /** Unique pass id; also the `serialNumber` inside pass.json. */
  serialNumber: string;
  tier: LoyaltyTier;
  /** Customer display name shown on the pass face. */
  holderName?: string;
  /** Loyalty point balance or order count, surfaced as a field. */
  balanceLabel?: string;
}

export interface GeneratedPass {
  passBuffer: Buffer;
  serialNumber: string;
}

export interface StoredPass {
  /** Signed URL the client uses to download the .pkpass (short TTL). */
  url: string;
  serialNumber: string;
}

export interface WalletPassService {
  /** Build + sign a .pkpass bundle in memory. */
  generatePass(fields: WalletPassFields): Promise<GeneratedPass>;
  /** Upload a pass blob to object storage, returning a signed URL. */
  uploadPass(pass: GeneratedPass): Promise<StoredPass>;
  /** Convenience: generate + upload in one call. */
  createSignedPassUrl(fields: WalletPassFields): Promise<StoredPass>;
}
