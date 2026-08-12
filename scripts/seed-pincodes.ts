// scripts/seed-pincodes.ts
// Task 1.8 — seeds serviceable pincodes for Delhi NCR (tier=fresh) and
// top metros (tier=shelf).
//
// Idempotent: find-by-pincode before create so re-runs skip existing records.
import { getPayload } from "@/lib/payload-client";
import { readFileSync } from "node:fs";

type PincodeRecord = {
  pincode: string;
  city: string;
  state: string;
  slaDays: number;
};

async function seedSet(
  payload: Awaited<ReturnType<typeof getPayload>>,
  filePath: string,
  tier: "fresh" | "shelf",
) {
  const records: PincodeRecord[] = JSON.parse(
    readFileSync(filePath, "utf8"),
  );
  let created = 0;
  let skipped = 0;

  for (const p of records) {
    // TODO: make idempotent — upsert by unique pincode (Payload create has no overwriteExisting)
    const existing = await payload.find({
      collection: "serviceablePincodes",
      where: { pincode: { equals: p.pincode } },
      limit: 1,
    });
    if (existing.docs.length > 0) {
      skipped++;
      continue;
    }
    await payload.create({
      collection: "serviceablePincodes",
      data: { ...p, tier, active: true },
    });
    created++;
  }

  return { created, skipped, total: records.length };
}

async function main() {
  const payload = await getPayload();

  const delhi = await seedSet(payload, "./data/delhi-ncr-pincodes.json", "fresh");
  const metros = await seedSet(payload, "./data/metro-pincodes.json", "shelf");

  console.log(
    `Seeded ${delhi.created} Delhi NCR pincodes (tier=fresh, ${delhi.skipped} skipped) + ` +
      `${metros.created} metro pincodes (tier=shelf, ${metros.skipped} skipped)`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
