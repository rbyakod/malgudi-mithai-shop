// collections/Stories.ts
// Brand storytelling posts — pillars cover farm, milk, karigar, packaging,
// festival, regional, recipe, journal. Stories support drafts and localization.
//
// Note: `slug` is required + unique because it's used for stable URLs.
// The brief's integration test originally omitted `slug`; the test was updated
// to include it (see task-6-brief.md "Known brief bugs" #1).
import type { CollectionConfig } from "payload";

export const Stories: CollectionConfig = {
  slug: "stories",
  access: {
    read: () => true,
  },
  admin: { useAsTitle: "title" },
  versions: { drafts: true },
  fields: [
    { name: "title", type: "text", localized: true, required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: { position: "sidebar" },
    },
    {
      name: "pillar",
      type: "select",
      required: true,
      options: [
        "farm",
        "milk",
        "karigar",
        "karigari",
        "packaging",
        "festival",
        "regional",
        "recipe",
        "journal",
      ],
    },
    { name: "body", type: "richText", localized: true },
    { name: "heroImage", type: "upload", relationTo: "media" },
    { name: "excerpt", type: "textarea", localized: true },
    {
      name: "relatedProducts",
      type: "relationship",
      relationTo: [
        "mithai-products",
        "gift-boxes",
        "qsr-menu-items",
        "snack-products",
        "merch-products",
      ],
      hasMany: true,
    },
    {
      name: "relatedVerticals",
      type: "select",
      hasMany: true,
      options: ["mithai", "gift-builder", "qsr", "snacks", "merch"],
    },
    { name: "publishedAt", type: "date" },
  ],
};
