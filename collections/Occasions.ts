// collections/Occasions.ts
// Gifting occasions — Diwali, weddings, Rakhi, corporate milestones, etc.
// Each occasion has localized name + copy, a hero image, and a curated
// set of recommended products drawn from the mithai and gift-box catalogs.
import type { CollectionConfig } from "payload";

export const Occasions: CollectionConfig = {
  slug: "occasions",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    { name: "copy", type: "textarea", localized: true },
    { name: "image", type: "upload", relationTo: "media" },
    {
      name: "recommendedProducts",
      type: "relationship",
      relationTo: ["mithai-products", "gift-boxes"],
      hasMany: true,
    },
  ],
};
