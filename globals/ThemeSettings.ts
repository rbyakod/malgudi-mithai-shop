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
      name: "storefrontLayoutMode",
      type: "select",
      label: "Storefront width",
      defaultValue: "fixed",
      admin: {
        description:
          "Choose Fixed for the earlier centered layout, or Full width for wider catalog pages.",
      },
      options: [
        {
          label: "Fixed width",
          value: "fixed",
        },
        {
          label: "Full width",
          value: "full",
        },
      ],
    },
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
