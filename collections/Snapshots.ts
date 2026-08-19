// collections/Snapshots.ts
// Cart snapshots collection — Task 4.4 (Mishran Mobile Apps v1).
//
// Persists the cart snapshot produced by POST /cart/validate so the
// subsequent create-order route can re-read it server-side rather than
// trusting a client-supplied cart. Provides the server-trust property
// the brief calls out: totals/items/pincode are stamped at validate
// time and cannot be tampered with between validate and create-order.
//
// Field shape mirrors OrderCreateSnapshot (lib/commerce/OrderService.ts)
// so PayloadOrderService.createFromSnapshot can consume the doc directly
// after a thin mapping in the route.
//
// TTL: expiresAt is indexed for a future cleanup cron (Payload 3.x has
// no native TTL option — see IdempotencyKeys.ts for the same pattern).
import type { CollectionConfig } from "payload";

export const Snapshots: CollectionConfig = {
  slug: "snapshots",
  timestamps: true,
  admin: {
    hidden: true,
    useAsTitle: "id",
    group: "06 Commerce",
    defaultColumns: ["id", "customerId", "pincodeTier", "expiresAt", "createdAt"],
  },
  indexes: [{ fields: ["customerId", "createdAt"] }],
  fields: [
    {
      name: "customerId",
      type: "relationship",
      relationTo: "customers",
      required: true,
      index: true,
    },
    {
      // Array of cart line items at validate time. Stored as json (not a
      // typed array) so the schema here does not have to mirror every
      // field on OrderItem; the route maps into OrderCreateSnapshot.items.
      name: "items",
      type: "json",
      required: true,
    },
    {
      // OrderTotals at validate time. json group would also work; json
      // keeps the totals blob opaque at this layer.
      name: "totals",
      type: "json",
      required: true,
    },
    {
      name: "pincode",
      type: "text",
      required: true,
      maxLength: 10,
    },
    {
      name: "pincodeTier",
      type: "text",
      required: true,
    },
    {
      name: "slot",
      type: "json",
    },
    {
      // Coupon code resolved at validate time whose discount is folded
      // into totals.discountInPaise. Copied onto the order at
      // create-order time (razorpay and COD paths both).
      name: "couponCode",
      type: "text",
    },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      index: true,
    },
  ],
};

export default Snapshots;
