// collections/GiftBoxes.ts
// Gift box / hamper collection — gifting vertical. Supports a builder-style
// schema: size, compartment layout, compatible mithai, packaging options,
// and curated assortments. Schema per spec §7 / task-7-brief.md.
//
// Slug "gift-boxes" is the stable contract — referenced by Stories,
// Occasions, and MithaiProducts.boxCompatibility.
import type { CollectionConfig } from "payload";
import { makeRevalidateHook, makeRevalidateDeleteHook } from "./_revalidate-hook";
import { GiftBoxCell } from "@/components/payload-admin/cells/product-cell-behaviors";

export const GiftBoxes: CollectionConfig = {
  slug: "gift-boxes",
  access: { read: () => true },
  admin: { useAsTitle: "name", group: "02 Products" },
  hooks: {
    afterChange: [makeRevalidateHook("gift-boxes")],
    afterDelete: [makeRevalidateDeleteHook("gift-boxes")],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      localized: true,
      admin: { components: { Cell: GiftBoxCell } },
    },
    {
      name: "size",
      type: "select",
      options: ["4-piece", "8-piece", "16-piece", "custom"],
    },
    { name: "compartmentLayout", type: "textarea" },
    {
      name: "compatibleMithai",
      type: "relationship",
      relationTo: "mithai-products",
      hasMany: true,
    },
    {
      name: "packaging",
      type: "relationship",
      relationTo: "packaging",
      hasMany: true,
    },
    {
      name: "addOns",
      type: "array",
      fields: [
        { name: "label", type: "text" },
        {
          name: "type",
          type: "select",
          options: ["carry-bag", "sleeve", "ribbon", "card"],
        },
      ],
    },
    {
      name: "images",
      type: "array",
      fields: [{ name: "image", type: "upload", relationTo: "media" }],
    },
    {
      name: "curatedAssortments",
      type: "array",
      fields: [
        { name: "label", type: "text" },
        {
          name: "items",
          type: "relationship",
          relationTo: "mithai-products",
          hasMany: true,
        },
      ],
    },
  ],
};
