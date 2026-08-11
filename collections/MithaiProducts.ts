// collections/MithaiProducts.ts
// Mithai (Indian sweets) product collection — the core vertical.
// Schema per spec §7 / task-7-brief.md. Discriminators: `family` (required)
// segments the mithai catalogue; `freshnessStatus` drives fulfillment copy
// ("made-daily", "made-to-order", "batch-frozen"); `displayPrice` is a
// display-only string (commerce / variant pricing deferred to Phase 8).
//
// `images` does NOT enforce `minRows: 1` — the brief specified it, but doing
// so would make the Task 7 seed + integration test fail (no media uploaded
// yet). Task 16 (sample PDP) will exercise the image requirement properly;
// promote to `minRows: 1` then. See task-7-brief.md "Known brief bugs" #3.
//
// Slug "mithai-products" is the stable contract — referenced by Stories,
// Karigars, Occasions, GiftBoxes, and SnackProducts via relationships.
import type { CollectionConfig } from "payload";
import { makeRevalidateHook, makeRevalidateDeleteHook } from "./_revalidate-hook";

export const MithaiProducts: CollectionConfig = {
  slug: "mithai-products",
  access: { read: () => true },
  admin: { useAsTitle: "name", group: "Mithai" },
  versions: { drafts: true },
  hooks: {
    afterChange: [makeRevalidateHook("mithai-products")],
    afterDelete: [makeRevalidateDeleteHook("mithai-products")],
  },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: { position: "sidebar" },
    },
    {
      name: "family",
      type: "select",
      required: true,
      options: ["classic", "original", "sugar-free", "regional", "seasonal"],
    },
    { name: "ingredients", type: "textarea", localized: true },
    { name: "allergens", type: "text", hasMany: true },
    { name: "shelfLife", type: "text" },
    { name: "storage", type: "textarea", localized: true },
    {
      name: "freshnessStatus",
      type: "select",
      options: ["made-daily", "made-to-order", "batch-frozen"],
    },
    { name: "dietaryTags", type: "text", hasMany: true },
    {
      name: "boxCompatibility",
      type: "relationship",
      relationTo: "gift-boxes",
      hasMany: true,
    },
    {
      name: "packagingCompatibility",
      type: "relationship",
      relationTo: "packaging",
      hasMany: true,
    },
    { name: "leadTime", type: "text" },
    {
      name: "images",
      type: "array",
      fields: [{ name: "image", type: "upload", relationTo: "media" }],
      // minRows: 1 deferred to Task 16 — see file header.
    },
    { name: "story", type: "richText", localized: true },
    { name: "karigar", type: "relationship", relationTo: "karigars" },
    {
      name: "displayPrice",
      type: "text",
      admin: {
        description: "Display-only. Commerce deferred to Phase 8.",
      },
    },
  ],
};
