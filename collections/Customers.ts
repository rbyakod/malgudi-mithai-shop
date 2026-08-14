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
    { fields: ["appleSub"], unique: true },
    { fields: ["createdAt"] },
  ],
  fields: [
    {
      name: "phone",
      type: "text",
      // Optional since Task 15.3: Sign-in-with-Apple customers carry an email
      // + appleSub but no phone. OTP customers always set phone. The unique
      // index still prevents duplicate phone rows; sparse-ish behavior comes
      // from app-level upsert (find-by-phone → update/create).
      required: false,
      unique: true,
      maxLength: 15,
    },
    {
      // Apple "sub" — the stable, app-scoped user identifier from the
      // identityToken (Task 15.3). Unique per Apple user per team. NULL for
      // OTP-only customers; the unique index de-dupes Apple upserts.
      name: "appleSub",
      type: "text",
      unique: true,
    },
    {
      name: "authProvider",
      type: "select",
      defaultValue: "phone",
      options: [
        { label: "Phone OTP", value: "phone" },
        { label: "Apple", value: "apple" },
      ],
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
    {
      name: "defaultAddresses",
      type: "array",
      fields: [
        {
          name: "addressId",
          type: "relationship",
          relationTo: "addresses",
        },
      ],
    },
    { name: "lastIp", type: "text" },
    { name: "lastSeenAt", type: "date" },
  ],
};

export default Customers;
