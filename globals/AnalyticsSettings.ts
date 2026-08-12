import type { GlobalConfig } from "payload";

export const AnalyticsSettings: GlobalConfig = {
  slug: "analytics-settings",
  access: {
    read: () => true,
  },
  admin: {
    group: "05 Settings",
  },
  fields: [
    {
      name: "ga4Id",
      type: "text",
    },
    {
      name: "metaPixelId",
      type: "text",
    },
    {
      name: "hotjarId",
      type: "text",
    },
    {
      name: "whatsappNumber",
      type: "text",
    },
  ],
};
