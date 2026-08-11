// collections/SnackProducts.ts
// FMCG snack products — namkeen, cookies, dry-fruit. Schema per spec §7 /
// task-7-brief.md. Includes external retailer links (these SKUs are sold
// through third-party channels, not direct checkout).
//
// Slug "snack-products" is the stable contract — referenced by Stories.
import type { CollectionConfig } from "payload";
import { makeRevalidateHook } from "./_revalidate-hook";

export const SnackProducts: CollectionConfig = {
  slug: "snack-products",
  access: { read: () => true },
  admin: { useAsTitle: "name", group: "FMCG" },
  hooks: { afterChange: [makeRevalidateHook("snack-products")] },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    {
      name: "category",
      type: "select",
      options: ["namkeen", "cookie", "dry-fruit"],
      required: true,
    },
    { name: "weight", type: "text" },
    { name: "description", type: "textarea", localized: true },
    {
      name: "images",
      type: "array",
      fields: [{ name: "image", type: "upload", relationTo: "media" }],
    },
    {
      name: "externalRetailers",
      type: "array",
      fields: [
        { name: "label", type: "text" },
        { name: "url", type: "text" },
      ],
    },
    { name: "msrp", type: "text" },
  ],
};
