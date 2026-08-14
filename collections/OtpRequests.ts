// collections/OtpRequests.ts
// OTP requests collection — Task 1.7 (Mishran Mobile Apps v1).
// Schema per task-1.7-brief.md Step 1 with corrections for Payload 3.x
// compatibility (Mongoose-style indexes normalized to string arrays;
// TTL `expireAfterSeconds` dropped — Payload 3.x CompoundIndex has no
// such option; enforce via cleanup cron).
// TODO: TTL index on expiresAt — enforce via cleanup cron (Payload 3.x has no expireAfterSeconds option)
import type { CollectionConfig } from "payload";

export const OtpRequests: CollectionConfig = {
  slug: "otpRequests",
  timestamps: true,
  admin: {
    group: "Auth",
    defaultColumns: ["phone", "expiresAt", "createdAt"],
    useAsTitle: "phone",
  },
  indexes: [
    { fields: ["phone", "createdAt"] },
  ],
  fields: [
    { name: "phone", type: "text", required: true, index: true },
    { name: "codeHash", type: "text", required: true },
    { name: "attempts", type: "number", defaultValue: 0 },
    { name: "expiresAt", type: "date", required: true, index: true },
    { name: "consumedAt", type: "date" },
    { name: "messageId", type: "text" },
  ],
};

export default OtpRequests;
