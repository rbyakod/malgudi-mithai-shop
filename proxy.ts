// proxy.ts
// Next.js 16 renames middleware.ts -> proxy.ts. This is the
// next-intl locale routing proxy. Payload admin (/admin), the staff
// consoles (/staff — pages live OUTSIDE the [locale] segment, so an
// intl redirect to /<locale>/staff/… would 404), and Payload
// REST/GraphQL (/api/...) must be excluded so they aren't redirected
// to /<locale>/admin etc.
import createMiddleware from "next-intl/middleware";
import {NextRequest, NextResponse} from "next/server";
import {routing} from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-mishran-pathname", pathname);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/admin/:path*", "/((?!api|trpc|_next|_vercel|admin|staff|.*\\..*).*)"]
};
