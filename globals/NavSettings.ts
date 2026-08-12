import type { GlobalConfig } from "payload";

export const NavSettings: GlobalConfig = {
  slug: "nav-settings",
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "primaryNav",
      type: "array",
      fields: [
        {
          name: "label",
          type: "text",
          localized: true,
        },
        {
          name: "href",
          type: "text",
        },
      ],
    },
    {
      name: "utilityNav",
      type: "array",
      fields: [
        {
          name: "label",
          type: "text",
          localized: true,
        },
        {
          name: "href",
          type: "text",
        },
      ],
    },
  ],
};
