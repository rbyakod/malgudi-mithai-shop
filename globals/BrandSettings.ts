import type { GlobalConfig } from "payload";

export const BrandSettings: GlobalConfig = {
  slug: "brand-settings",
  access: {
    read: () => true,
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
      options: ["mishran-default", "diwali-saffron", "wedding-heritage", "everyday-sage"],
      defaultValue: "mishran-default",
    },
  ],
};
