// collections/RevokedTokens.ts
// Revoked tokens collection — Task 1.7 (Mishran Mobile Apps v1).
// Schema per task-1.7-brief.md Step 4 with corrections for Payload 3.x
// compatibility (Mongoose-style indexes normalized to string arrays;
// TTL `expireAfterSeconds` dropped — Payload 3.x CompoundIndex has no
// such option; enforce via cleanup cron).
// TODO: TTL index on expiresAt — enforce via cleanup cron (Payload 3.x has no expireAfterSeconds option)
import type { CollectionConfig } from "payload";

export const RevokedTokens: CollectionConfig = {
  slug: "revokedTokens",
  timestamps: true,
  admin: { hidden: true },
  indexes: [],
  fields: [
    { name: "jti", type: "text", required: true, unique: true, index: true },
    {
      name: "customerId",
      type: "relationship",
      relationTo: "customers",
      required: true,
    },
    {
      name: "reason",
      type: "select",
      options: ["logout", "rotation", "revoked", "biometric_reset"].map((v) => ({
        label: v,
        value: v,
      })),
    },
    { name: "expiresAt", type: "date", required: true, index: true },
  ],
};

export default RevokedTokens;
