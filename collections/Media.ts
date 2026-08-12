// collections/Media.ts
// Central upload collection. All image/video uploads (Stories heroImage,
// Karigars portrait, Farms gallery, Packaging images, Occasions image)
// reference this collection via `relationTo: "media"`.
//
// Payload 3.87 removed `staticURL` from UploadConfig — files are now served
// via Payload's built-in file route (/api/media/file/:filename) rather than
// a static URL prefix. `staticDir` remains and controls where uploaded files
// are written on disk. Verified against
// node_modules/payload/dist/uploads/types.d.ts.
import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
  slug: "media",
  upload: {
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
