import type { GlobalConfig } from "payload";

export const BrandSettings: GlobalConfig = {
  slug: "brand-settings",
  access: {
    read: () => true,
  },
  admin: {
    group: "04 Storefront",
  },
  fields: [
    {
      name: "logo",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "brandName",
      type: "text",
      defaultValue: "Mishran",
      localized: true,
    },
    {
      name: "tagline",
      type: "text",
      localized: true,
    },
    {
      name: "positioning",
      type: "textarea",
      localized: true,
    },
    {
      name: "heroCopy",
      type: "textarea",
      localized: true,
    },
    {
      name: "defaultTheme",
      type: "select",
      label: "Default theme (mobile apps)",
      admin: {
        description:
          "Used by the mobile apps only. The website's starting theme is set in Theme Settings → Website default theme.",
      },
      options: ["mishran-default", "diwali-saffron", "wedding-heritage", "everyday-sage"],
      defaultValue: "mishran-default",
    },
  ],
};
