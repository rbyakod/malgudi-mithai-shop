// collections/Reviews.ts
// Product reviews — conversion batch, Batch A (A4).
//
// Capture-only for now: reviews are written exclusively through
// POST /api/mobile/v1/reviews (auth'd, one per customer+product, upsert)
// and moderated in admin. No public display anywhere yet — surfacing on
// the PDP (with AggregateRating schema) is deferred until approved real
// reviews exist (see the conversion-batch plan's deferred register).
//
// Access: reads/updates/deletes are admin-only; create is closed at the
// collection level so rows can only be born through the API route's
// validated path (the route uses the local API, which bypasses access).
import type { CollectionConfig } from "payload";

export const Reviews: CollectionConfig = {
  slug: "reviews",
  admin: {
    useAsTitle: "rating",
    group: "04 Storefront",
    defaultColumns: ["id", "product", "customer", "rating", "verifiedPurchase", "status", "createdAt"],
  },
  indexes: [
    // The API route's upsert lookup: one review per (customer, product).
    { fields: ["customer", "product"] },
  ],
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "product",
      type: "relationship",
      relationTo: "mithai-products",
      required: true,
      index: true,
    },
    {
      name: "customer",
      type: "relationship",
      relationTo: "customers",
      required: true,
      index: true,
    },
    // Display name captured at review time; falls back to the customer's
    // saved name at moderation/display time when absent.
    { name: "authorName", type: "text" },
    {
      name: "rating",
      type: "number",
      required: true,
      min: 1,
      max: 5,
    },
    { name: "body", type: "textarea" },
    {
      name: "order",
      type: "relationship",
      relationTo: "orders",
    },
    // Server-stamped by the API route: true when the customer has a
    // delivered order containing this product (the linked `order` row).
    { name: "verifiedPurchase", type: "checkbox", defaultValue: false },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: ["pending", "approved", "rejected"].map((v) => ({
        label: v,
        value: v,
      })),
      index: true,
    },
  ],
};

export default Reviews;
