import type { CollectionConfig } from "payload";

export const Drafts: CollectionConfig = {
  slug: "drafts",
  admin: { hidden: true, useAsTitle: "sessionId", group: "04 Storefront" },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    { name: "sessionId", type: "text", required: true, unique: true },
    { name: "config", type: "json" },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      admin: { position: "sidebar" },
    },
    { name: "convertedToLead", type: "relationship", relationTo: "leads" },
  ],
};
