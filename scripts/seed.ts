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
// Self-healing: when a doc already exists, we still `update` it with the
// seed data so DBs from older schema versions (missing newly-added fields
// like localized `ingredients`/`allergens`/`storage`) get back-filled
// without requiring a manual `mongo` drop. Re-running after a schema tweak
// is therefore safe at the field level, not just at the record level.
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
  // Sample story for the /stories hub (Task 18). One farm-pillar doc so the
  // hub has something to render before editors fill the rest. `body` is a
  // minimal Payload lexical tree — one paragraph — in the same shape admins
  // would author via the richtext-lexical editor. `_status: "published"`
  // ships it as a published doc because the Stories collection has
  // `versions: {drafts: true}` (otherwise the Local API default is draft,
  // and the hub's published filter would hide it).
  {
    collection: "stories",
    data: {
      title: "Jhajjar Farm: Where Our Milk Begins",
      slug: "jhajjar-farm",
      pillar: "farm",
      // Stories has `versions: {drafts: true}`, which injects the system
      // `_status` field. Per Payload's drafts quick-reference table,
      // passing `_status: "published"` in `data` is the documented way to
      // create / publish in a single Local API call — otherwise the doc
      // ships as `_status: "draft"` and the hub's published filter hides
      // it.
      _status: "published",
      excerpt:
        "Before a single katli is rolled, the milk is already two hours old. A morning at the Jhajjar farm, where every batch of Mishran mithai begins.",
      body: {
        root: {
          type: "root",
          format: "",
          indent: 0,
          version: 1,
          children: [
            {
              type: "paragraph",
              format: "",
              indent: 0,
              version: 1,
              children: [
                {
                  type: "text",
                  format: 0,
                  text: "The cows are milked before sunrise. By the time the kitchen in Bengaluru lights its first burner, the morning's milk is already on its way south — boiled down to kakvi within hours of leaving the byre. No milk powder, no reconstituted cream, ever. That single non-negotiable is why a Mishran katli tastes the way it does: clean, browned, and unmistakably itself.",
                  detail: 0,
                  mode: "normal",
                  style: "",
                  textStyles: {},
                  version: 1,
                },
              ],
              direction: "ltr",
              textStyle: {},
              textFormat: 0,
              indentLevel: 0,
            },
          ],
          direction: "ltr",
        },
      },
      publishedAt: new Date().toISOString(),
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
    const id = existing.docs[0]!.id;
    await payload.update({
      collection: seed.collection,
      id,
      data: seed.data,
    });
    console.log(`  [update] ${seed.collection}/${value}`);
    return;
  }
  await payload.create({ collection: seed.collection, data: seed.data });
  console.log(`  [create] ${seed.collection}/${value}`);
}

async function main() {
  const payload = await getPayload();
  console.log("Seeding product collections + sample story...");
  for (const seed of seeds) {
    await createIfMissing(payload, seed);
  }
  // Create the AutoLogin dev user (idempotent). AutoLogin requires the
  // user to exist in the DB; without this the admin panel bounces to
  // /admin/login even when isLocalDev is true.
  const devEmail = "dev@mithai.shop";
  const devUserExisting = await payload.find({
    collection: "users",
    where: { email: { equals: devEmail } },
    limit: 1,
  });
  if (devUserExisting.docs.length === 0) {
    await payload.create({
      collection: "users",
      data: { email: devEmail, password: "dev-password" },
    });
    console.log(`  [create] users/${devEmail}`);
  } else {
    console.log(`  [skip] users/${devEmail} exists`);
  }
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
