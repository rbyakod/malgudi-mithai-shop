import type { GlobalConfig } from "payload";
import { MAX_FEE_RUPEES, MAX_THRESHOLD_RUPEES, validateRupees } from "../lib/commerce/deliveryLimits";

// Delivery fees and the free-delivery thresholds, in rupees. Previously these lived only in server settings
// (DELIVERY_FEE_*_PAISE, FREE_DELIVERY_THRESHOLD_*_PAISE); a value entered here now takes precedence, and an empty
// field falls back to that server value. Read through lib/commerce/deliveryRules.ts (cached for about 30 seconds).
// Only admins may change it: it changes what every customer pays.
// A custom validate replaces Payload's built-in min/max check, so the range is enforced inside validateRupees.
const rupees = (max: number) => ({
  type: "number" as const,
  min: 0,
  max,
  validate: validateRupees(max),
});

export const DeliverySettings: GlobalConfig = {
  slug: "delivery-settings",
  label: "Delivery & fees",
  access: {
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => user?.role === "admin",
  },
  admin: {
    group: "06 Commerce",
    description:
      "What delivery costs and when it is free. Changes apply to new carts within about half a minute; orders already placed keep the amount they were charged. Leave a field empty to use the shop's standard value.",
  },
  versions: { max: 50 },
  hooks: {
    beforeChange: [
      ({ data, req }) => ({
        ...data,
        lastChangedBy: (req.user as { email?: string } | null)?.email ?? "unknown",
        lastChangedAt: new Date().toISOString(),
      }),
    ],
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "freshFee",
          label: "Delivery fee: fresh (same-city), ₹",
          ...rupees(MAX_FEE_RUPEES),
          admin: { description: "Charged on fresh products delivered in the city. Leave empty for the standard fee." },
        },
        {
          name: "shelfStableFee",
          label: "Delivery fee: shelf-stable (courier), ₹",
          ...rupees(MAX_FEE_RUPEES),
          admin: { description: "Charged on shelf-stable products sent by courier. Leave empty for the standard fee." },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "freshFreeThreshold",
          label: "Free delivery from: fresh, ₹",
          ...rupees(MAX_THRESHOLD_RUPEES),
          admin: { description: "Carts at or above this subtotal get free delivery. 0 turns free delivery off. Leave empty for the standard threshold." },
        },
        {
          name: "shelfStableFreeThreshold",
          label: "Free delivery from: shelf-stable, ₹",
          ...rupees(MAX_THRESHOLD_RUPEES),
          admin: { description: "Same for shelf-stable. 0 turns free delivery off. Leave empty for the standard threshold." },
        },
      ],
    },
    { name: "lastChangedBy", type: "text", admin: { readOnly: true, description: "Set automatically." } },
    { name: "lastChangedAt", type: "text", admin: { readOnly: true, description: "Set automatically." } },
  ],
};
