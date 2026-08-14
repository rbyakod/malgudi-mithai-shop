// collections/SecurityEvents.ts
// Security events collection — Task 1.7 (Mishran Mobile Apps v1).
// Schema per task-1.7-brief.md Step 5 with corrections for Payload 3.x
// compatibility (Mongoose-style indexes normalized to string arrays).
import type { CollectionConfig } from "payload";

export const SecurityEvents: CollectionConfig = {
  slug: "securityEvents",
  timestamps: true,
  admin: {
    group: "Auth",
    defaultColumns: ["type", "customerId", "createdAt"],
    useAsTitle: "type",
  },
  indexes: [
    { fields: ["type", "createdAt"] },
    { fields: ["customerId"] },
  ],
  fields: [
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        "otp_brute_force",
        "token_reuse_new_ip",
        "webhook_signature_fail",
        "webhook_config_error",
        "webhook_malformed_json",
        "mass_refund_attempt",
        "unusual_order_pattern",
      ].map((v) => ({ label: v, value: v })),
    },
    {
      name: "customerId",
      type: "relationship",
      relationTo: "customers",
    },
    { name: "ip", type: "text" },
    { name: "details", type: "json" },
  ],
};

export default SecurityEvents;
