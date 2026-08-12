import type { GlobalConfig } from "payload";

export const ThemeSettings: GlobalConfig = {
  slug: "theme-settings",
  access: {
    read: () => true,
  },
  admin: {
    group: "04 Storefront",
  },
  fields: [
    {
      name: "themes",
      type: "array",
      fields: [
        {
          name: "themeId",
          type: "text",
        },
        {
          name: "label",
          type: "text",
          localized: true,
        },
        {
          name: "canvas",
          type: "text",
        },
        {
          name: "surface",
          type: "text",
        },
        {
          name: "accent",
          type: "text",
        },
        {
          name: "pop",
          type: "text",
        },
        {
          name: "ink",
          type: "text",
        },
      ],
    },
  ],
};
