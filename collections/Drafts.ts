import type { CollectionConfig } from "payload";

export const Drafts: CollectionConfig = {
  slug: "drafts",
  admin: { useAsTitle: "sessionId", group: "Ops" },
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
  hooks: {
    afterInit: async (args) => {
      const { collection } = args;
      // Create TTL index on expiresAt field for 30-day expiration
      // This runs after the collection model is initialized
      if (collection.model?.db?.collections?.drafts) {
        try {
          await collection.model.db.collections.drafts.collection.createIndex(
            { expiresAt: 1 },
            { expireAfterSeconds: 0 },
          );
        } catch (error) {
          console.warn("Failed to create TTL index on drafts.expiresAt:", error);
        }
      }
    },
  },
};
