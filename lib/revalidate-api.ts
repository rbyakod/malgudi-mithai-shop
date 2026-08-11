// lib/revalidate-api.ts
// Pure handler for POST /api/revalidate. Extracted from the route module so
// the auth + dispatch logic can be reasoned about without HTTP. The route at
// app/api/revalidate/route.ts is a thin re-export.
//
// Accepts three body shapes (any one is sufficient):
//   1. {path: "/en/mithai/kaju-katli"}  → revalidatePath(path)
//   2. {collection, slug}                → revalidatePath per-locale PDP path
//   3. {}                                → layout fallback (full purge)
//
// Auth: when REVALIDATE_SECRET is set, the request must carry an
// `x-revalidate-secret` header matching it. When unset, the route is open
// (dev convenience). Production MUST set the secret.
//
// Route precedence note: Payload mounts a catchall at
// app/(payload)/api/[...slug]. Next.js route specificity picks this concrete
// app/api/revalidate/route.ts over the catchall — verified by the e2e test.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * Locked locale list (en, hi, kn). Mirrors i18n config and the [locale]
 * dynamic segment. Any addition here must be mirrored in app/[locale].
 */
const LOCALES = ["en", "hi", "kn"] as const;

/**
 * Collection slug → public route prefix. Maps a Payload collection to the
 * URL segment under /[locale]/ where its PDPs live. Collections without a
 * public PDP route (gift-boxes) are absent and fall through to the layout
 * fallback in the dispatcher.
 */
const COLLECTION_ROUTES: Record<string, string> = {
  "mithai-products": "mithai",
  "qsr-menu-items": "qsr",
  "snack-products": "snacks",
  "merch-products": "merch",
  stories: "stories",
};

interface RevalidateBody {
  path?: string;
  collection?: string;
  slug?: string;
}

/**
 * POST /api/revalidate — purge ISR cache for one path, one doc, or all.
 */
export async function handleRevalidatePost(req: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (secret && req.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({error: "unauthorized"}, {status: 401});
  }

  const body = (await req.json().catch(() => ({}))) as RevalidateBody;

  if (body.path) {
    revalidatePath(body.path);
    console.log("[revalidate] purged path:", body.path);
  } else if (body.collection && body.slug) {
    const segment = COLLECTION_ROUTES[body.collection];
    if (segment) {
      for (const locale of LOCALES) {
        const p = `/${locale}/${segment}/${body.slug}`;
        revalidatePath(p);
      }
      console.log(
        "[revalidate] purged collection/slug:",
        body.collection,
        body.slug,
      );
    } else {
      // Unknown / route-less collection (e.g. gift-boxes today) — full purge.
      revalidatePath("/", "layout");
      console.log(
        "[revalidate] layout fallback for collection:",
        body.collection,
      );
    }
  } else {
    revalidatePath("/", "layout");
    console.log("[revalidate] layout fallback (empty body)");
  }

  return NextResponse.json({revalidated: true});
}
