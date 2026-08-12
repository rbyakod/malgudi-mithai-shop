import type { CollectionConfig } from "payload";

export const Leads: CollectionConfig = {
  slug: "leads",
  admin: { useAsTitle: "type", group: "03 Catalog Ops" },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => true,
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: "type",
      type: "select",
      required: true,
      options: ["wedding", "corporate", "merch", "gift-builder-draft", "wholesale", "general"],
    },
    {
      name: "contact",
      type: "group",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "email", type: "email", required: true },
        { name: "phone", type: "text" },
        { name: "company", type: "text" },
        {
          name: "GSTIN",
          type: "text",
          admin: { description: "GSTIN for corporate leads" },
        },
      ],
    },
    {
      name: "payload",
      type: "json",
      admin: {
        description:
          "Free-form lead details (occasion, qty, budget, date, city, selectedProducts, message).",
      },
    },
    {
      name: "status",
      type: "select",
      options: ["new", "contacted", "qualified", "won", "lost"],
      defaultValue: "new",
      required: true,
      admin: { position: "sidebar" },
    },
    { name: "source", type: "text" },
    { name: "convertedFromDraft", type: "relationship", relationTo: "drafts" },
  ],
  timestamps: true,
};
