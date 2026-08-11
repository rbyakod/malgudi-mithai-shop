// next.config.mjs
import createNextIntlPlugin from "next-intl/plugin";
import { withPayload } from "@payloadcms/next/withPayload";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // You can keep any other Next.js config here
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// withPayload must wrap the final config so Payload's webpack/turbopack
// aliases (e.g. @payload-config) and dependencies are injected.
export default withPayload(withNextIntl(nextConfig));
