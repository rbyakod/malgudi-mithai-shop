// collections/Karigars.ts
// Karigars (artisan sweet-makers) — the human side of the brand.
// Each karigar has an archetype, portrait, story, and links to the mithai
// products they specialize in or are known for.
import type { CollectionConfig } from "payload";

export const Karigars: CollectionConfig = {
  slug: "karigars",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "archetype",
      type: "select",
      options: [
        "chenna-specialist",
        "kaju-specialist",
        "ghee-specialist",
        "halwai",
      ],
    },
    { name: "portrait", type: "upload", relationTo: "media" },
    { name: "story", type: "richText", localized: true },
    {
      name: "specialties",
      type: "relationship",
      relationTo: "mithai-products",
      hasMany: true,
    },
    {
      name: "signatureProducts",
      type: "relationship",
      relationTo: "mithai-products",
      hasMany: true,
    },
  ],
};
