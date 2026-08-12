// collections/IdempotencyKeys.ts
// Idempotency keys collection — Task 1.7 (Mishran Mobile Apps v1).
// Schema per task-1.7-brief.md Step 3 with corrections for Payload 3.x
// compatibility (Mongoose-style indexes normalized to string arrays;
// TTL `expireAfterSeconds` dropped — Payload 3.x CompoundIndex has no
// such option; enforce via cleanup cron).
// TODO: TTL index on expiresAt — enforce via cleanup cron (Payload 3.x has no expireAfterSeconds option)
import type { CollectionConfig } from "payload";

export const IdempotencyKeys: CollectionConfig = {
  slug: "idempotencyKeys",
  timestamps: true,
  admin: { hidden: true },
  indexes: [],
  fields: [
    { name: "key", type: "text", required: true, unique: true, index: true },
    { name: "requestHash", type: "text", required: true },
    { name: "responseStatus", type: "number", required: true },
    { name: "responseBody", type: "json", required: true },
    { name: "expiresAt", type: "date", required: true, index: true },
  ],
};

export default IdempotencyKeys;
