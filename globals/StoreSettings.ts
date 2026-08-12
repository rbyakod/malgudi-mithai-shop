import type { GlobalConfig } from "payload";

export const StoreSettings: GlobalConfig = {
  slug: "store-settings",
  access: {
    read: () => true,
  },
  admin: {
    group: "05 Settings",
  },
  fields: [
    {
      name: "stores",
      type: "array",
      fields: [
        {
          name: "name",
          type: "text",
        },
        {
          name: "city",
          type: "text",
        },
        {
          name: "address",
          type: "textarea",
        },
        {
          name: "hours",
          type: "text",
        },
        {
          name: "deliveryRadiusKm",
          type: "number",
        },
        {
          name: "lat",
          type: "number",
        },
        {
          name: "lng",
          type: "number",
        },
      ],
    },
  ],
};
