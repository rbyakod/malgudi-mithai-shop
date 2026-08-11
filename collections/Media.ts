// collections/Media.ts
// Central upload collection. All image/video uploads (Stories heroImage,
// Karigars portrait, Farms gallery, Packaging images, Occasions image)
// reference this collection via `relationTo: "media"`.
//
// Upload config shape verified against
// node_modules/payload/dist/uploads/types.d.ts — Payload 3 still accepts
// { staticURL, staticDir, imageSizes }.
import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
  slug: "media",
  upload: {
    staticURL: "/media",
    staticDir: "media",
    imageSizes: [
      { name: "thumbnail", width: 400, height: 300 },
      { name: "card", width: 800, height: 600 },
      { name: "hero", width: 1600, height: 900 },
    ],
  },
  access: { read: () => true },
  fields: [{ name: "alt", type: "text", localized: true }],
};
