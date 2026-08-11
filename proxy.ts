// proxy.ts
// Next.js 16 renames middleware.ts -> proxy.ts. This is the
// next-intl locale routing proxy. Payload admin (/admin) and
// Payload REST/GraphQL (/api/...) must be excluded so they
// aren't redirected to /<locale>/admin etc.
import createMiddleware from "next-intl/middleware";
import {routing} from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|admin|.*\\..*).*)"]
};