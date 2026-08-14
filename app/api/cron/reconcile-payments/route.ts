// app/api/cron/reconcile-payments/route.ts
// Reconciliation cron endpoint — Task 4.7 (Mishran Mobile Apps v1).
//
// Hit by:
//   - Vercel Cron (config in vercel.ts): every 15 min, /15 * * * *
//   - Any external scheduler (self-hosted): same path, same auth header.
//
// AUTH: a static shared secret sent as `Authorization: Bearer <secret>`.
// Configured via CRON_SECRET env var. Comparison uses timingSafeEqual to
// avoid timing side-channels even though the threat model is weak
// (single-tenant scheduler) — the helper is cheap and the alternative
// (string ===) is a public foot-gun.
//
// PATH DEPTH NOTE: app/api/cron/reconcile-payments/ = 4 dirs under app/
// (api=1, cron=2, reconcile-payments=3 — app/ itself is the project
// root's first child and doesn't count as a "level up"). From route.ts
// to repo root: 4 `../`. Same depth as the webhook route
// (app/api/webhooks/razorpay/route.ts), which uses the same 4 `../`.
import { timingSafeEqual } from 'node:crypto';
import { reconcilePayments } from '../../../../lib/reconciliation/reconcilePayments';

/**
 * Timing-safe string compare. Short-circuits on length mismatch (otherwise
 * timingSafeEqual throws RangeError on unequal-length buffers).
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;

  // No secret configured — operator misconfiguration, not a normal 401.
  // Return 500 so monitoring surfaces it. (503 would also be defensible;
  // we pick 500 because the broken thing is the config, not a transient
  // outage — caller should NOT retry, they should fix the env var.)
  if (!secret) {
    return new Response('cron misconfigured: missing CRON_SECRET', {
      status: 500,
    });
  }

  // Expected: "Bearer <secret>". Compare the full header value so we
  // don't accidentally accept e.g. "Bearer<secret>" (missing space) or
  // other scheme confusion. Timing-safe on the whole string.
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return new Response('unauthorized', { status: 401 });
  }

  const result = await reconcilePayments();
  return new Response(
    JSON.stringify({
      status: 'ok',
      ...result,
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
}
