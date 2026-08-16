// collections/CartDrafts.ts
// Server-side cart drafts (abandonment data) — conversion batch, Batch A (A5).
//
// The web cart syncs itself here (debounced POST /api/cart-drafts keyed by
// a random session id) so an abandoned cart can be recovered: a
// consent-gated email reminder (cron, A6) links back to
// /{locale}/cart?draft={sessionId} which restores the items client-side.
//
// Modeled on collections/Drafts.ts: session-keyed, upsert-by-sessionId,
// 30-day expiresAt refreshed on every write (TTL index created at boot in
// payload.config.ts). Access is create/update-open like Drafts (the API
// route is the writer and reads go through the local API); admin can read
// and delete for moderation.
import type { CollectionConfig } from "payload";

export const CartDrafts: CollectionConfig = {
  slug: "cart-drafts",
  admin: {
    useAsTitle: "sessionId",
    group: "04 Storefront",
    defaultColumns: ["id", "sessionId", "email", "marketingConsent", "status", "reminderSentAt", "updatedAt"],
  },
  indexes: [
    { fields: ["lastActivityAt"] },
    { fields: ["expiresAt"] },
  ],
  access: {
    // Anonymous readers must NOT list carts via REST; the restore + cron
    // paths use the local API (overrideAccess default true). The public
    // GET-by-sessionId route never returns email.
    read: ({ req }) => Boolean(req.user),
    create: () => true,
    update: () => true,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "sessionId",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "customerId",
      type: "relationship",
      relationTo: "customers",
      index: true,
    },
    // Web cart lines ({id, name, priceLabel, quantity, image}).
    { name: "items", type: "json" },
    // {subtotalInPaise|null, itemCount, tier} — client estimate snapshot.
    { name: "estimate", type: "json" },
    // Captured only when the shopper opts in ("Email me this cart").
    { name: "email", type: "text" },
    { name: "marketingConsent", type: "checkbox", defaultValue: false },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      options: ["active", "converted"].map((v) => ({ label: v, value: v })),
      index: true,
    },
    // Set once by the abandoned-cart cron — one reminder per draft, ever.
    { name: "reminderSentAt", type: "date" },
    { name: "lastActivityAt", type: "date", index: true },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      admin: { position: "sidebar" },
    },
  ],
};

export default CartDrafts;
