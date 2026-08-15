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
      name: "showThemeSwitcher",
      type: "checkbox",
      label: "Show Theme Studio in storefront header",
      defaultValue: false,
      admin: {
        description:
          "Keep off for launch. Enable only during preview or internal design review.",
      },
    },
    {
      name: "catalogPageSize",
      type: "number",
      label: "Catalog items per page",
      defaultValue: 100,
      min: 12,
      max: 120,
      admin: {
        description:
          "Controls how many products appear before pagination. Default is 100.",
      },
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
