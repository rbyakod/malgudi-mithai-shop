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
      name: "heroStyle",
      type: "select",
      label: "Home hero style",
      defaultValue: "framed",
      admin: {
        description:
          "Framed: editorial two-column hero with a rotating product card. Cinematic: full-width image band with headline overlay and product chip. Switch anytime to compare with customers.",
      },
      options: [
        {
          label: "Framed (editorial card)",
          value: "framed",
        },
        {
          label: "Cinematic (full-bleed band)",
          value: "cinematic",
        },
      ],
    },
    {
      name: "productImageMotion",
      type: "checkbox",
      label: "Product image motion",
      defaultValue: true,
      admin: {
        description:
          "Slow cinematic drift on product imagery across the storefront. Uncheck to keep imagery perfectly still.",
      },
    },
    {
      name: "themeSwitcherVisibility",
      type: "select",
      label: "Theme Studio visibility",
      defaultValue: "disabled",
      admin: {
        description:
          "Controls whether the customer-facing Theme Studio appears on the storefront. Keep disabled for launch.",
      },
      options: [
        {
          label: "Disabled",
          value: "disabled",
        },
        {
          label: "Home page only",
          value: "home",
        },
        {
          label: "All storefront pages",
          value: "all",
        },
      ],
    },
    {
      name: "showThemeSwitcher",
      type: "checkbox",
      label: "Show Theme Studio in storefront header",
      defaultValue: false,
      admin: {
        hidden: true,
        description:
          "Legacy flag retained for older saved settings. Use Theme Studio visibility instead.",
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
