// scripts/seed.ts
// Sample seed for the 5 product collections (Task 7). Creates 1 record per
// vertical so /admin has something to show during dev, and so the test DB
// has fixtures to render against.
//
// Idempotent: each create is guarded by a `find({ slug })` (or name for
// slugless collections) so re-runs skip existing records instead of
// duplicating them. Standard seed hygiene — the brief doesn't mandate it
// but re-running `npm run seed` after schema tweaks should be safe.
//
// Runs against the same MongoDB instance as `next dev`
// (MONGODB_URI from .env.local — see lib/payload-client.ts + payload.config.ts).
import { getPayload } from "@/lib/payload-client";

type Seed = {
  collection: string;
  /** Field used for the idempotency lookup. Defaults to "slug". */
  lookupField?: string;
  data: Record<string, unknown>;
};

const seeds: Seed[] = [
  {
    collection: "mithai-products",
    data: {
      name: "Kaju Katli",
      slug: "kaju-katli",
      family: "classic",
      shelfLife: "7 days",
      storage: "Room temperature, airtight.",
      displayPrice: "₹920 / 250g",
      freshnessStatus: "made-to-order",
      ingredients: "Cashew, sugar, kakvi.",
    },
  },
  {
    collection: "gift-boxes",
    // GiftBoxes has no slug field — use name as the idempotency key.
    lookupField: "name",
    data: { name: "Heritage 16-piece Hamper", size: "16-piece" },
  },
  {
    collection: "qsr-menu-items",
    lookupField: "name",
    data: {
      name: "Chole Bhature",
      category: "chole-bhature",
      veg: true,
      spiceLevel: "medium",
    },
  },
  {
    collection: "snack-products",
    lookupField: "name",
    data: { name: "Aloo Bhujia", category: "namkeen", weight: "200g", msrp: "₹60" },
  },
  {
    collection: "merch-products",
    lookupField: "name",
    data: {
      name: "Mithai-Making Tool Set",
      type: "tool",
      availability: "enquiry-only",
    },
  },
];

async function createIfMissing(payload: Awaited<ReturnType<typeof getPayload>>, seed: Seed) {
  const field = seed.lookupField ?? "slug";
  const value = seed.data[field];
  if (value === undefined) {
    throw new Error(
      `seed for "${seed.collection}" is missing lookup field "${field}"`,
    );
  }
  const existing = await payload.find({
    collection: seed.collection,
    where: { [field]: { equals: value } },
    limit: 1,
  });
  if (existing.docs.length > 0) {
    console.log(`  [skip] ${seed.collection}/${value} already exists`);
    return;
  }
  await payload.create({ collection: seed.collection, data: seed.data });
  console.log(`  [create] ${seed.collection}/${value}`);
}

async function main() {
  const payload = await getPayload();
  console.log("Seeding 5 product collections...");
  for (const seed of seeds) {
    await createIfMissing(payload, seed);
  }
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
