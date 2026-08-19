// collections/QsrMenuItems.ts
// Quick-Service Restaurant (QSR) menu items — chaat, chole-bhature, kulcha,
// thaali, chinese, south-indian. Schema per spec §7 / task-7-brief.md.
//
// DEVATION from brief: `availableAtStores` is a plain `text` field with
// `hasMany: true` (array of store slugs/ids as strings) rather than a
// `relationship` to `stores`. The `stores` collection does not exist yet —
// Task 8 (Payload globals) introduces the StoreSettings global, at which
// point this field can be promoted to a relationship if a proper stores
// collection materializes. Brief "Known brief bugs" #2 recommends the
// simpler path; we follow that.
//
// Slug "qsr-menu-items" is the stable contract — referenced by Stories.
import type { CollectionConfig } from "payload";
import { makeRevalidateHook, makeRevalidateDeleteHook } from "./_revalidate-hook";

// Custom Cell referenced by string path — Payload importMap resolves it.
const QsrMenuCellPath = "./components/payload-admin/cells/QsrMenuCell";

export const QsrMenuItems: CollectionConfig = {
  slug: "qsr-menu-items",
  labels: {singular: "QSR menu item", plural: "QSR Menu"},
  access: { read: () => true },
  admin: { useAsTitle: "name", group: "02 Products" },
  // #131: drafts + autosave — editors iterate without publishing; published reads
  // (storefront + mobile API) are unchanged: find() defaults to published,
  // and seed creates without draft:true still publish.
  versions: { drafts: { autosave: { interval: 1200 } } },
  hooks: {
    afterChange: [makeRevalidateHook("qsr-menu-items")],
    afterDelete: [makeRevalidateDeleteHook("qsr-menu-items")],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      localized: true,
      admin: { components: { Cell: QsrMenuCellPath } },
    },
    {
      name: "category",
      type: "select",
      options: [
        "chaat",
        "chole-bhature",
        "kulcha",
        "thaali",
        "chinese",
        "south-indian",
      ],
      required: true,
    },
    { name: "description", type: "textarea", localized: true },
    { name: "image", type: "upload", relationTo: "media" },
    { name: "veg", type: "checkbox" },
    {
      name: "spiceLevel",
      type: "select",
      options: ["mild", "medium", "hot"],
    },
    {
      name: "availableAtStores",
      type: "text",
      hasMany: true,
      admin: {
        description:
          "Store slugs/ids where this item is available. Plain text for now — Task 8 may promote to a relationship once StoreSettings global exists.",
      },
    },
  ],
};
