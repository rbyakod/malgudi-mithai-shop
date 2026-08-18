// scripts/seed-occasions.ts
// #75 — seeds the `occasions` collection so /occasions renders real content.
// Each occasion: name (URL = slugify(name)), copy, hero image (existing media
// filename), and a curated recommendedProducts rail drawn from mithai-products
// (matched by slug) and gift-boxes (matched by name).
//
// Curation notes: copy is evergreen (no hardcoded festival dates); heroes reuse
// product photography already in the media library. Safe to re-run: occasions
// are find-by-name first, never duplicated. Missing slugs/names warn and skip
// so a stale entry never breaks the seed.
import { getPayload } from "@/lib/payload-client";

type Ref =
  | { kind: "mithai"; slug: string }
  | { kind: "gift"; name: string };

type OccasionFixture = {
  name: string;
  copy: string;
  heroFilename?: string;
  refs: Ref[];
};

const FIXTURES: OccasionFixture[] = [
  {
    name: "Diwali",
    copy: "The season of lights, done properly: silver-leaf kaju katli, kesar-stamped burfi and motichoor laddu boxed for gifting rounds. Pair the classics with a festive hamper so every doorstep visit carries something memorable.",
    heroFilename: "Kaju_Katli_Burfi_2_1.jpg",
    refs: [
      { kind: "mithai", slug: "kaju-katli" },
      { kind: "mithai", slug: "kaju-kesar-burfi" },
      { kind: "mithai", slug: "khoya-pista-burfi" },
      { kind: "mithai", slug: "soan-papdi-desi-ghee" },
      { kind: "mithai", slug: "motichoor-laddu" },
      { kind: "mithai", slug: "besan-burfi" },
      { kind: "mithai", slug: "kaju-kalash" },
      { kind: "gift", name: "Festive Sweets & Snack Hamper" },
      { kind: "gift", name: "Tyohar Treats Hamper" },
      { kind: "gift", name: "Premium Gift Hamper" },
    ],
  },
  {
    name: "Weddings",
    copy: "Muhurtham mornings and baraat nights run on mithai. Motichoor laddu, kaju kalash and kesar peda in boxes that hold up through a long day — plus hampers your guests carry home.",
    heroFilename: "Motichoor_Laddu.jpg",
    refs: [
      { kind: "mithai", slug: "motichoor-laddu" },
      { kind: "mithai", slug: "kaju-kalash" },
      { kind: "mithai", slug: "kaju-roll" },
      { kind: "mithai", slug: "badam-katli" },
      { kind: "mithai", slug: "khoya-kesar-peda" },
      { kind: "mithai", slug: "kheer-kadam" },
      { kind: "mithai", slug: "kaju-anjeer-roll" },
      { kind: "gift", name: "Heritage 16-piece Hamper" },
      { kind: "gift", name: "UtsavTokri Hamper" },
      { kind: "gift", name: "Shubh Celebration Hamper" },
    ],
  },
  {
    name: "Raksha Bandhan",
    copy: "Rakhi deserves better than a last-minute box. Rose laddu, kaju katli and chocolate mithai your sibling will actually photograph — and hampers built for the brother-sister exchange.",
    heroFilename: "Rose_Laddu.png",
    refs: [
      { kind: "mithai", slug: "kaju-katli" },
      { kind: "mithai", slug: "rose-laddu" },
      { kind: "mithai", slug: "kaju-rose-cake" },
      { kind: "mithai", slug: "chocolate-laddu" },
      { kind: "mithai", slug: "kaju-paan" },
      { kind: "gift", name: "Sibling Surprise Hamper" },
      { kind: "gift", name: "SnehBandhan Hamper" },
    ],
  },
  {
    name: "Housewarming",
    copy: "Griha pravesh calls for kalash-shaped kaju, kesariya peda and halwa made fresh for the day. A sweet start for a new address — send a hamper ahead of the pooja and it arrives ready to serve.",
    heroFilename: "KajuKalash_400x400pxl.jpg",
    refs: [
      { kind: "mithai", slug: "kaju-kalash" },
      { kind: "mithai", slug: "khoya-lal-peda" },
      { kind: "mithai", slug: "khoya-kesar-peda" },
      { kind: "mithai", slug: "assorted-peda" },
      { kind: "mithai", slug: "badam-halwa" },
      { kind: "mithai", slug: "milk-cake" },
      { kind: "mithai", slug: "shahi-pinni" },
      { kind: "gift", name: "Celebration Hamper" },
      { kind: "gift", name: "Shubh Celebration Hamper" },
    ],
  },
  {
    name: "Corporate Gifting",
    copy: "Client gifts that don't end up in a drawer. Kaju katli and dry-fruit mithai in considered packaging, from desk-friendly boxes to premium hampers — with bulk enquiry and branding on request.",
    heroFilename: "Sweets_Box.png",
    refs: [
      { kind: "mithai", slug: "kaju-katli" },
      { kind: "mithai", slug: "badam-katli" },
      { kind: "mithai", slug: "dry-fruit-burfi-sugar-free" },
      { kind: "mithai", slug: "anjeer-dryfruit-burfee" },
      { kind: "mithai", slug: "dry-fruits-laddu" },
      { kind: "mithai", slug: "kaju-cake" },
      { kind: "gift", name: "Heritage 16-piece Hamper" },
      { kind: "gift", name: "Premium Gift Hamper" },
      { kind: "gift", name: "UtsavTokri Hamper" },
      { kind: "gift", name: "Zestybox Hamper" },
      { kind: "gift", name: "Deluxe Snack Hamper" },
    ],
  },
  {
    name: "Holi",
    copy: "Gujiya by the tray, til buggha in every colour, and hampers that survive a rowdy Holi. Sweet, salty and thandai-ready — stock the table before the colours come out.",
    heroFilename: "Sweets_Box-2.png",
    refs: [
      { kind: "mithai", slug: "ghar-ki-gujia" },
      { kind: "mithai", slug: "longlata-gujia-sweet" },
      { kind: "mithai", slug: "gur-til-buggha" },
      { kind: "mithai", slug: "shahi-til-buggha" },
      { kind: "mithai", slug: "plain-til-buggha" },
      { kind: "mithai", slug: "panjeeri-laddu" },
      { kind: "gift", name: "Thandai Tradition Holi Hamper" },
      { kind: "gift", name: "Celebrate Holi Hamper" },
      { kind: "gift", name: "Gujia Thal Holi Hamper" },
      { kind: "gift", name: "Royal Rang Holi Hamper" },
      { kind: "gift", name: "Saffron Splash Holi Hamper" },
    ],
  },
  {
    name: "Birthdays & Celebrations",
    copy: "Chocolate laddu, baklava and mewa bites for the people who claim they don't like sweets. Small indulgences and celebration hampers that make an ordinary Tuesday feel planned.",
    heroFilename: "White_Chocolate_laddu.jpg",
    refs: [
      { kind: "mithai", slug: "chocolate-laddu" },
      { kind: "mithai", slug: "white-chocolate-laddu" },
      { kind: "mithai", slug: "caramel-toffee-peda" },
      { kind: "mithai", slug: "khoya-chocolate-burfi" },
      { kind: "mithai", slug: "baklava-choco-delight" },
      { kind: "mithai", slug: "mewa-bite-chocolate" },
      { kind: "gift", name: "Chocobox Hamper" },
      { kind: "gift", name: "Celebration Hamper" },
      { kind: "gift", name: "Premium Basket Hamper" },
    ],
  },
];

async function resolveRef(
  payload: Awaited<ReturnType<typeof getPayload>>,
  ref: Ref,
): Promise<{ relationTo: string; value: string | number } | null> {
  if (ref.kind === "mithai") {
    const r = await payload.find({
      collection: "mithai-products",
      where: { slug: { equals: ref.slug } },
      limit: 1,
    });
    if (!r.docs.length) {
      console.warn(`  warn: mithai slug not found: ${ref.slug}`);
      return null;
    }
    return { relationTo: "mithai-products", value: r.docs[0].id };
  }
  const r = await payload.find({
    collection: "gift-boxes",
    where: { name: { equals: ref.name } },
    limit: 1,
  });
  if (!r.docs.length) {
    console.warn(`  warn: gift box not found: ${ref.name}`);
    return null;
  }
  return { relationTo: "gift-boxes", value: r.docs[0].id };
}

async function main() {
  const payload = await getPayload();

  for (const fixture of FIXTURES) {
    const existing = await payload.find({
      collection: "occasions",
      where: { name: { equals: fixture.name } },
      limit: 1,
    });
    if (existing.docs.length > 0) {
      console.log(`skip  ${fixture.name} (exists)`);
      continue;
    }

    const recommendedProducts = [];
    for (const ref of fixture.refs) {
      const resolved = await resolveRef(payload, ref);
      if (resolved) recommendedProducts.push(resolved);
    }

    let image: string | number | undefined;
    if (fixture.heroFilename) {
      const media = await payload.find({
        collection: "media",
        where: { filename: { equals: fixture.heroFilename } },
        limit: 1,
      });
      if (media.docs.length > 0) image = media.docs[0].id;
      else console.warn(`  warn: hero image not found: ${fixture.heroFilename}`);
    }

    await payload.create({
      collection: "occasions",
      data: {
        name: fixture.name,
        copy: fixture.copy,
        ...(image ? { image } : {}),
        recommendedProducts,
      },
    });
    console.log(
      `seed  ${fixture.name} (${recommendedProducts.length} products, hero ${image ? "yes" : "none"})`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
