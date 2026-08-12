// collections/Farms.ts
// Source farms — provenance storytelling for milk and other ingredients.
// Each farm has a location, story, image gallery, milk-process writeup,
// and a list of certifications.
import type { CollectionConfig } from "payload";

export const Farms: CollectionConfig = {
  slug: "farms",
  access: { read: () => true },
  admin: { useAsTitle: "name", group: "01 Brand" },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "location", type: "text" },
    { name: "story", type: "richText", localized: true },
    {
      name: "gallery",
      type: "array",
      fields: [
        { name: "image", type: "upload", relationTo: "media" },
        { name: "caption", type: "text", localized: true },
      ],
    },
    { name: "milkProcess", type: "richText", localized: true },
    { name: "certifications", type: "text", hasMany: true },
  ],
};
