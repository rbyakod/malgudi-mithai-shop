// lib/wallet/impl/FakeWalletService.ts
// In-memory WalletPassService fake — Task 18.5.
//
// Produces a deterministic, recognizable buffer (NOT a valid signed pkpass —
// that requires Apple passbook certs) and a fake signed URL. Downstream tests
// (loyalty eligibility route) assert on the contract (serialNumber echoed, URL
// returned) without needing cert fixtures or MinIO.
import type {
  WalletPassService,
  WalletPassFields,
  GeneratedPass,
  StoredPass,
} from "../WalletPassService";

export class FakeWalletService implements WalletPassService {
  /** Captures the last-generated fields so tests can assert on them. */
  lastGenerated: WalletPassFields | null = null;

  async generatePass(fields: WalletPassFields): Promise<GeneratedPass> {
    this.lastGenerated = fields;
    // A recognizable placeholder body; encodes the serial so tests can confirm
    // round-tripping without parsing a real pkpass.
    const passBuffer = Buffer.from(
      `FAKE-PKPASS:${fields.serialNumber}:${fields.tier}`,
      "utf8",
    );
    return { passBuffer, serialNumber: fields.serialNumber };
  }

  async uploadPass(pass: GeneratedPass): Promise<StoredPass> {
    return {
      url: `https://fake-cdn.example.com/wallet/${pass.serialNumber}.pkpass?token=fake`,
      serialNumber: pass.serialNumber,
    };
  }

  async createSignedPassUrl(fields: WalletPassFields): Promise<StoredPass> {
    const pass = await this.generatePass(fields);
    return this.uploadPass(pass);
  }
}
