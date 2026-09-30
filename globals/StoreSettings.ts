import type { GlobalConfig } from "payload";

// The shop's own locations. The FIRST store is the main one: its city, address and opening hours appear in the site
// footer, the top brand bar, the contact page and the search-engine data (lib/store-info.ts). Delivery coverage is
// NOT set here: it is decided by the Serviceable pincodes (06 Commerce).
export const StoreSettings: GlobalConfig = {
  slug: "store-settings",
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  admin: {
    group: "05 Settings",
    description:
      "Your shop locations. The first store is the main one shown in the footer, contact page and search results. Delivery areas are set in Serviceable pincodes, not here.",
  },
  fields: [
    {
      name: "stores",
      type: "array",
      fields: [
        { name: "name", type: "text", admin: { description: "For example: Mishran Sweets & Restaurant." } },
        { name: "city", type: "text", admin: { description: "Shown as the shop's city, for example in the top bar and search results." } },
        { name: "state", type: "text" },
        { name: "postalCode", type: "text", label: "Postal code" },
        {
          name: "address",
          type: "textarea",
          admin: { description: "Street and area only. The city, state and postal code are added from the fields around it." },
        },
        {
          name: "hours",
          type: "text",
          admin: { description: "Opening hours as customers should read them. Leave empty to publish no hours." },
        },
      ],
    },
  ],
};
