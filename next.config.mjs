// next.config.mjs
import createNextIntlPlugin from "next-intl/plugin";
import { withPayload } from "@payloadcms/next/withPayload";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Mishran SVGs are first-party assets in /public/admin — safe to permit.
    // Required so <Image src="/admin/mishran-crest.svg" /> works.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// withPayload must wrap the final config so Payload's webpack/turbopack
// aliases (e.g. @payload-config) and dependencies are injected.
export default withPayload(withNextIntl(nextConfig));
