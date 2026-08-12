import type { CollectionConfig } from "payload";

export const Customers: CollectionConfig = {
  slug: "customers",
  auth: false,
  timestamps: true,
  admin: {
    useAsTitle: "phone",
    defaultColumns: ["phone", "name", "locale", "createdAt"],
  },
  indexes: [
    { fields: ["phone"], unique: true },
    { fields: ["createdAt"] },
  ],
  fields: [
    {
      name: "phone",
      type: "text",
      required: true,
      unique: true,
      maxLength: 15,
    },
    { name: "name", type: "text" },
    { name: "email", type: "email" },
    {
      name: "locale",
      type: "select",
      defaultValue: "en",
      options: ["en", "hi", "kn", "ta", "te", "mr", "gu", "bn", "pa"].map(
        (code) => ({ label: code, value: code }),
      ),
    },
    // TODO(Task 1.4 or follow-up): add defaultAddresses as array of relationships to 'addresses' collection once it lands.
    { name: "lastIp", type: "text" },
    { name: "lastSeenAt", type: "date" },
  ],
};

export default Customers;
