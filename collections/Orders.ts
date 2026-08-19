// collections/Orders.ts
// Orders collection — Task 1.5 (Mishran Mobile Apps v1).
// Shared commerce types live in lib/commerce/types.ts (consumed by services,
// mobile apps, and admin). Schema per task-1.5-brief.md Step 2 with
// corrections for Payload 3.x compatibility (see brief corrections).
//
// Audit §05: fields are grouped into unnamed tabs (label-only, no `name`)
// which reorganize the edit view while keeping every field at the TOP LEVEL
// — API paths, the create-order service, and mobile clients are unchanged.
// Money fields keep their *InPaise names (API contract) but carry human
// labels; list views render ₹ via RupeeCell.
import type { CollectionConfig } from "payload";

// Custom Cells are referenced by string path — Payload's importMap generator
// (and admin runtime) resolves them to components/payload-admin/cells/*.
const OrderStatusCellPath = "./components/payload-admin/cells/OrderStatusCell";
const RupeeCellPath = "./components/payload-admin/cells/RupeeCell";

export const Orders: CollectionConfig = {
  slug: "orders",
  labels: { singular: "Order", plural: "Orders" },
  timestamps: true,
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "id",
      "status",
      "paymentMethod",
      "totals.totalInPaise",
      "createdAt",
    ],
    group: "06 Commerce",
  },
  indexes: [{ fields: ["customerId", "createdAt"] }],
  fields: [
    {
      // Unnamed tabs → fields stay top-level (see file header).
      type: "tabs",
      tabs: [
        {
          label: "Order",
          fields: [
            {
              name: "customerId",
              type: "relationship",
              relationTo: "customers",
              required: true,
              label: "Customer",
              index: true,
            },
            {
              name: "status",
              type: "select",
              required: true,
              defaultValue: "created",
              options: [
                "created",
                "pending_payment",
                "confirmed",
                "packed",
                "dispatched",
                "out_for_delivery",
                "delivered",
                "payment_failed",
                "cancelled",
                "returned",
                "failed_delivery",
                "abandoned",
              ].map((v) => ({ label: v, value: v })),
              index: true,
              admin: {
                components: {
                  Cell: OrderStatusCellPath,
                },
              },
            },
            {
              name: "paymentStatus",
              type: "select",
              required: true,
              defaultValue: "pending",
              options: ["pending", "paid", "failed", "refunded", "partially_refunded"].map(
                (v) => ({ label: v, value: v }),
              ),
            },
            {
              // How the order collects its money. razorpay: prepaid via the
              // Razorpay sheet. cod: cash at the door — born confirmed with
              // paymentStatus pending until staff mark cash collected
              // (razorpayOrderId stays null so payment jobs skip it).
              name: "paymentMethod",
              type: "select",
              required: true,
              defaultValue: "razorpay",
              options: ["razorpay", "cod"].map((v) => ({ label: v, value: v })),
            },
            {
              name: "source",
              type: "select",
              required: true,
              options: ["mobile-android", "mobile-ios", "web"].map((v) => ({
                label: v,
                value: v,
              })),
            },
            // Coupon whose discount is reflected in totals.discountInPaise.
            // Copied from the cart snapshot at create-order time; burned usage
            // counters live on the Coupons row.
            { name: "couponCode", type: "text", label: "Coupon code", index: true },
            {
              name: "slot",
              type: "group",
              label: "Delivery slot",
              fields: [
                { name: "date", type: "date", label: "Delivery date" },
                { name: "window", type: "text", label: "Delivery window" },
              ],
            },
          ],
        },
        {
          label: "Items",
          fields: [
            {
              name: "items",
              type: "array",
              required: true,
              minRows: 1,
              labels: { singular: "Line item", plural: "Line items" },
              fields: [
                {
                  name: "productId",
                  type: "relationship",
                  relationTo: "mithai-products",
                  required: true,
                  label: "Product",
                },
                { name: "slug", type: "text", required: true },
                { name: "name", type: "text", required: true },
                { name: "quantity", type: "number", required: true, min: 1 },
                // Pack-size label the line was priced against (cart ids of the
                // form `${productId}:${packLabel}`). Optional — legacy/test orders
                // and base-pack lines carry none; reorder falls back to the base
                // pack for those. Copied through from cart snapshots at
                // create-order time.
                { name: "packLabel", type: "text", label: "Pack label" },
                { name: "unit", type: "text", required: true },
                {
                  name: "priceInPaise",
                  type: "number",
                  required: true,
                  min: 0,
                  label: "Unit price (paise)",
                },
                { name: "image", type: "text", label: "Image URL" },
              ],
            },
          ],
        },
        {
          label: "Totals",
          description: "Stored in paise (₹1 = 100 paise) — lists display ₹.",
          fields: [
            {
              name: "totals",
              type: "group",
              required: true,
              fields: [
                {
                  name: "itemsTotalInPaise",
                  type: "number",
                  required: true,
                  label: "Items total (paise)",
                },
                {
                  name: "deliveryFeeInPaise",
                  type: "number",
                  required: true,
                  label: "Delivery fee (paise)",
                },
                { name: "taxesInPaise", type: "number", required: true, label: "Taxes (paise)" },
                {
                  name: "discountInPaise",
                  type: "number",
                  required: true,
                  defaultValue: 0,
                  label: "Discount (paise)",
                },
                {
                  name: "totalInPaise",
                  type: "number",
                  required: true,
                  label: "Total (paise)",
                  admin: {
                    components: {
                      Cell: RupeeCellPath,
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          label: "Payment & delivery",
          fields: [
            // TODO: enforce unique razorpayOrderId when set (service-layer validation,
            // not schema-level — Payload has no sparse option; marking it unique here
            // would cause null-conflicts between unpaid orders).
            {
              name: "razorpayOrderId",
              type: "text",
              label: "Razorpay order ID",
            },
            {
              name: "deliveryAddressId",
              type: "relationship",
              relationTo: "addresses",
              required: true,
              label: "Delivery address",
            },
            {
              name: "cartSnapshotId",
              type: "text",
              label: "Cart snapshot ID",
            },
          ],
        },
      ],
    },
  ],
};

export default Orders;
