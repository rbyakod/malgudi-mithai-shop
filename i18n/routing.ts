// i18n/routing.ts
import {defineRouting} from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es", "fr", "hi", "kn", "ta", "te", "bn", "mr", "gu"],
  defaultLocale: "en",
  localePrefix: "always"
});