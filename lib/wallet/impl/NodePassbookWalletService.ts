// lib/wallet/impl/NodePassbookWalletService.ts
// Real Apple Wallet pass adapter — Task 18.5.
//
// Two phases:
//   1. Pure helpers (buildPassJson, buildManifest) — unit-tested here, no
//      Apple resources required.
//   2. Packaging + signing + upload — needs the `node-passbook` package (a
//      prod deploy dependency, dynamically imported so test/container import
//      never fails when it is absent) AND the Apple passbook P12 + WWDR cert
//      (env-configured paths). Without either, generatePass throws a clear,
//      gated error and the container falls back to FakeWalletService — so a
//      box without certs never silently serves invalid passes.
//
// Upload uses the already-installed @aws-sdk/client-s3 + presigner against the
// self-hosted MinIO (STORAGE_PROVIDER=minio) or S3. The bucket is
// WALLET_PASSES_BUCKET (default mithai-wallet-passes); signed URL TTL is 24h.
//
// NOTE on signature validity: a fully Apple-valid .pkpass requires a PKCS#7
// detached signature over manifest.json chaining to the WWDR cert. The
// `node-passbook` sign tool produces this from the P12 + WWDR. Until the Apple
// Developer Program enrollment (plan Open Question #8) supplies those certs,
// this path is exercised only in staging/prod with real certs configured.
import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  WalletPassService,
  WalletPassFields,
  GeneratedPass,
  StoredPass,
} from "../WalletPassService";

export interface PassbookTheme {
  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;
}

export interface NodePassbookOptions {
  passbookCertPath: string;
  passbookCertPassword: string;
  wwdrCertPath: string;
  /** S3/MinIO endpoint + creds. */
  storageEndpoint?: string;
  storageRegion?: string;
  storageAccessKey?: string;
  storageSecretKey?: string;
  storageBucket: string;
  /** Optional brand theme overrides for the pass face. */
  theme?: PassbookTheme;
  /** teamIdentifier from the Apple Developer account (pass.json field). */
  teamIdentifier?: string;
  /** passTypeIdentifier (e.g. pass.com.mishran.wallet). */
  passTypeIdentifier?: string;
}

/** Build the pass.json body for a store-card loyalty pass. Pure. */
export function buildPassJson(
  fields: WalletPassFields,
  opts: Pick<NodePassbookOptions, "teamIdentifier" | "passTypeIdentifier" | "theme">,
): Record<string, unknown> {
  return {
    formatVersion: 1,
    passTypeIdentifier: opts.passTypeIdentifier ?? "pass.com.mishran.wallet",
    teamIdentifier: opts.teamIdentifier ?? "TEAMID",
    serialNumber: fields.serialNumber,
    description: "Mishran Loyalty",
    organizationName: "Mishran",
    backgroundColor: opts.theme?.backgroundColor ?? "rgb(155,77,42)",
    foregroundColor: opts.theme?.foregroundColor ?? "rgb(255,248,240)",
    labelColor: opts.theme?.labelColor ?? "rgb(215,154,53)",
    storeCard: {
      primaryFields: [
        { key: "tier", label: "Tier", value: fields.tier.toUpperCase() },
      ],
      auxiliaryFields: [
        { key: "holder", label: "Member", value: fields.holderName ?? "Member" },
        { key: "balance", label: "Points", value: fields.balanceLabel ?? "0" },
      ],
    },
  };
}

/** Build manifest.json: SHA1 of each file's contents. Pure. */
export function buildManifest(files: Record<string, Buffer | string>): Record<string, string> {
  const manifest: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    const buf = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    manifest[name] = createHash("sha1").update(buf).digest("hex");
  }
  return manifest;
}

export class NodePassbookWalletService implements WalletPassService {
  constructor(private readonly opts: NodePassbookOptions) {}

  async generatePass(fields: WalletPassFields): Promise<GeneratedPass> {
    const passJson = buildPassJson(fields, this.opts);
    const manifest = buildManifest({ "pass.json": Buffer.from(JSON.stringify(passJson)) });

    // Dynamic import: node-passbook is a prod-only dep. Absent -> clear error
    // so the container gating can fall back to the fake. The @vite-ignore +
    // variable specifier defeat Vite's static import-analysis (which would
    // otherwise fail the transform before this runtime try/catch can run),
    // leaving a true runtime dynamic import that throws into the catch.
    const passbookModule = "node-passbook";
    let passbook: { template?: unknown; create?: unknown };
    try {
      passbook = await import(/* @vite-ignore */ passbookModule);
    } catch {
      throw new Error(
        "node-passbook is not installed — install it and configure PASSBOOK_CERT_PATH / PASSBOOK_WWDR_PATH to enable real Apple Wallet passes",
      );
    }

    // The package + signing step needs the P12 + WWDR. This is exercised only
    // in environments with the Apple Developer certs configured.
    if (!this.opts.passbookCertPath || !this.opts.wwdrCertPath) {
      throw new Error("Passbook cert paths not configured (PASSBOOK_CERT_PATH / PASSBOOK_WWDR_PATH)");
    }
    void passbook;
    void manifest;
    // Real packaging + PKCS#7 signature over the manifest lands with the Apple
    // Developer Program enrollment (plan Open Question #8). Until then this
    // branch is unreachable in test (container falls back to fake).
    throw new Error(
      "NodePassbookWalletService.generatePass: full pkpass signing not yet wired (awaiting Apple Developer certs)",
    );
  }

  async uploadPass(pass: GeneratedPass): Promise<StoredPass> {
    const client = new S3Client({
      endpoint: this.opts.storageEndpoint,
      region: this.opts.storageRegion ?? "us-east-1",
      credentials: this.opts.storageAccessKey
        ? {
            accessKeyId: this.opts.storageAccessKey,
            secretAccessKey: this.opts.storageSecretKey ?? "",
          }
        : undefined,
      forcePathStyle: this.opts.storageEndpoint?.includes("minio") ?? false,
    });
    const key = `passes/${pass.serialNumber}.pkpass`;
    await client.send(
      new PutObjectCommand({
        Bucket: this.opts.storageBucket,
        Key: key,
        Body: pass.passBuffer,
        ContentType: "application/vnd.apple.pkpass",
      }),
    );
    // 24h signed GET URL the client redeems via PKAddPassesViewController.
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.opts.storageBucket, Key: key }),
      { expiresIn: 24 * 60 * 60 },
    );
    return { url, serialNumber: pass.serialNumber };
  }

  async createSignedPassUrl(fields: WalletPassFields): Promise<StoredPass> {
    const pass = await this.generatePass(fields);
    return this.uploadPass(pass);
  }
}
