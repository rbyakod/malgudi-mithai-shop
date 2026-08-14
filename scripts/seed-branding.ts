// scripts/seed-branding.ts
// One-command restore for the one-off branding patches that live in the
// database rather than in the catalog JSONs:
//   1. `brand-settings` global — brandName "Mishran" + the sun-mark logo
//      (uploaded from public/images/mishran-logo.png).
//   2. The pre-existing demo `qsr-menu-items` doc "Chole Bhature" — attach
//      a freely-licensed Wikimedia Commons photo (it predates the catalog
//      seed and is not part of qsr-catalog.json).
//
// Idempotent: media upsert by `alt` (same convention as seed-catalog.ts),
// globals/docs updated in place. Run after `pnpm seed` + `pnpm seed:catalog`
// for a full dev-DB restore. Run:
//   pnpm seed:branding
import { getPayload } from "@/lib/payload-client";
import { readFile } from "node:fs/promises";

// Wikimedia Commons (freely licensed) — kept in sync with the fallback map
// in scripts/seed-data/build-sections.py.
const CHOLE_BHATURE_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Chole_Bhature_6.jpg/960px-Chole_Bhature_6.jpg";

async function fetchImageBuffer(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Mishran seed script)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mimetype = res.headers.get("content-type") ?? "image/jpeg";
  const ext = mimetype.includes("png") ? "png" : mimetype.includes("webp") ? "webp" : "jpg";
  const name = `${url.split("/").pop()?.split("?")[0]?.replace(/\.[^.]+$/, "") ?? "image"}.${ext}`;
  return { data: buf, mimetype, name, size: buf.length };
}

// Idempotent media upsert by `alt` (same helper contract as seed-catalog.ts).
async function ensureMediaFromUrl(
  payload: Awaited<ReturnType<typeof getPayload>>,
  alt: string,
  url: string,
) {
  const existing = await payload.find({
    collection: "media",
    where: { alt: { equals: alt } },
    limit: 1,
  });
  if (existing.docs.length > 0) return String(existing.docs[0]!.id);
  const doc = await payload.create({
    collection: "media",
    data: { alt },
    file: await fetchImageBuffer(url),
  });
  console.log(`  [media] ${alt}`);
  return String(doc.id);
}

async function ensureMediaFromFile(
  payload: Awaited<ReturnType<typeof getPayload>>,
  alt: string,
  path: string,
) {
  const existing = await payload.find({
    collection: "media",
    where: { alt: { equals: alt } },
    limit: 1,
  });
  if (existing.docs.length > 0) return String(existing.docs[0]!.id);
  const buf = await readFile(path);
  const doc = await payload.create({
    collection: "media",
    data: { alt },
    file: { data: buf, mimetype: "image/png", name: "mishran-logo.png", size: buf.length },
  });
  console.log(`  [media] ${alt}`);
  return String(doc.id);
}

async function main() {
  const payload = await getPayload();

  // 1. brand-settings global
  const logoId = await ensureMediaFromFile(payload, "mishran-sun-logo", "public/images/mishran-logo.png");
  await payload.updateGlobal({
    slug: "brand-settings",
    data: { brandName: "Mishran", logo: logoId },
  });
  const brand = await payload.findGlobal({ slug: "brand-settings" });
  console.log(`  [brand-settings] brandName=${brand.brandName} logo=${logoId}`);

  // 2. demo "Chole Bhature" qsr item
  const cbImage = await ensureMediaFromUrl(payload, "qsr-chole-bhature", CHOLE_BHATURE_IMAGE);
  const r = await payload.find({
    collection: "qsr-menu-items",
    where: { name: { equals: "Chole Bhature" } },
    limit: 1,
  });
  if (r.docs.length === 0) {
    console.log("  [qsr] demo 'Chole Bhature' not found — skipped (run seed first)");
  } else {
    await payload.update({
      collection: "qsr-menu-items",
      id: r.docs[0]!.id,
      data: { image: cbImage },
    });
    console.log("  [qsr] 'Chole Bhature' image attached");
  }

  console.log("\nBranding seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
