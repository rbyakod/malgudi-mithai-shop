// scripts/backfill-giftbox-price.ts
// One-off VPS backfill: stamp `displayPrice` + `excerpt` onto the existing
// `gift-boxes` docs (Batch 7 added both fields; the deployed DB already has
// the seeded boxes without them). Matches docs by `name` against
// scripts/seed-data/gift-catalog.json — idempotent, so re-running after a
// partial failure is safe: docs already carrying the target values are
// skipped and counted.
//
// Run once on the VPS after the Batch 7 deploy (re-running seed:catalog
// instead also works but re-fetches every gift image from the source CDN —
// this script touches no media):
//   node --env-file=.env --import tsx scripts/backfill-giftbox-price.ts
//
// Prints: updated / already-current / missing-name counts, then exits.
import { getPayload } from "@/lib/payload-client";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GIFT_PATH = resolve(__dirname, "seed-data/gift-catalog.json");

// Same derivation as scripts/seed-catalog.ts `deriveGiftExcerpt` — inlined
// here because importing from seed-catalog would execute its main() and run
// a full catalog seed.
function deriveGiftExcerpt(source: string | undefined): string | null {
  if (!source) return null;
  const text = source.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const sentenceEnd = text.search(/[.!?]/);
  const first = sentenceEnd > 0 ? text.slice(0, sentenceEnd + 1) : text;
  return first.length > 200 ? `${first.slice(0, 197).trimEnd()}…` : first;
}

type GiftBox = {
  name: string;
  displayPrice?: string;
  excerpt?: string;
  compartmentLayout: string;
};

async function main() {
  const { products } = JSON.parse(await readFile(GIFT_PATH, "utf8")) as {
    products: GiftBox[];
  };
  const payload = await getPayload();
  console.log(`Backfilling gift-boxes from ${GIFT_PATH} (${products.length} rows)...`);

  let updated = 0;
  let current = 0;
  let missing = 0;
  let priceWrites = 0;
  let excerptWrites = 0;

  for (const p of products) {
    const existing = await payload.find({
      collection: "gift-boxes",
      where: { name: { equals: p.name } },
      limit: 1,
    });
    if (existing.docs.length === 0) {
      console.warn(`  [missing] ${p.name}`);
      missing++;
      continue;
    }

    const doc = existing.docs[0] as { id: string | number; displayPrice?: string | null; excerpt?: string | null };
    const targetPrice = p.displayPrice ?? null;
    const targetExcerpt = p.excerpt ?? deriveGiftExcerpt(p.compartmentLayout);

    if ((doc.displayPrice ?? null) === targetPrice && (doc.excerpt ?? null) === targetExcerpt) {
      current++;
      continue;
    }

    await payload.update({
      collection: "gift-boxes",
      id: doc.id,
      data: { displayPrice: targetPrice, excerpt: targetExcerpt },
    });
    updated++;
    if ((doc.displayPrice ?? null) !== targetPrice) priceWrites++;
    if ((doc.excerpt ?? null) !== targetExcerpt) excerptWrites++;
    console.log(`  [updated] ${p.name} → ${targetPrice ?? "(no price)"}`);
  }

  console.log(
    `\nBackfill complete: ${updated} updated (${priceWrites} prices, ${excerptWrites} excerpts), ` +
      `${current} already current, ${missing} not found by name.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
