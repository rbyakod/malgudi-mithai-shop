// Curated slides for the brand home hero carousel. Editor picks products
// from any of the 5 product collections, drag-reorders, optionally
// overrides the caption per slide. Empty global → BrandHero falls back
// to static kaju-katli still life (see lib/home-hero.ts).
import type { GlobalConfig } from "payload";

export const HomeHero: GlobalConfig = {
  slug: "home-hero",
  label: "Home Hero",
  access: {
    read: () => true,
  },
  admin: {
    group: "04 Storefront",
  },
  fields: [
    {
      name: "autoplayMs",
      type: "number",
      label: "Autoplay interval (ms)",
      defaultValue: 5000,
      min: 3000,
      max: 15000,
      admin: {
        description:
          "Milliseconds between auto-advancing slides. Default 5000 (5s). Range 3000–15000. Honored only on the client; reduced-motion users never autoplay.",
        step: 500,
      },
    },
    {
      name: "slides",
      type: "array",
      label: "Hero slides",
      minRows: 0,
      maxRows: 12,
      labels: {
        singular: "Slide",
        plural: "Slides",
      },
      fields: [
        {
          name: "product",
          type: "relationship",
          relationTo: [
            "mithai-products",
            "qsr-menu-items",
            "snack-products",
            "merch-products",
            "gift-boxes",
          ],
          required: true,
          admin: {
            description: "Pick from any product collection.",
          },
        },
        {
          name: "captionOverride",
          type: "text",
          admin: {
            description: "Optional. Defaults to the product name.",
          },
        },
      ],
      admin: {
        description: "Drag rows to reorder. First row renders first on home.",
      },
    },
  ],
};
