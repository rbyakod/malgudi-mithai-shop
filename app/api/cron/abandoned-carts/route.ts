// app/api/cron/abandoned-carts/route.ts
// Abandoned-cart reminder cron — conversion batch, Batch A (A6).
//
// Hit by the same scheduler as /api/cron/reconcile-payments (Vercel Cron
// or any external scheduler) with the SAME auth:
//   Authorization: Bearer <CRON_SECRET>  (timing-safe compare, see below)
//
// Selects recoverable cart drafts —
//   status=active, marketingConsent=true, email present, reminderSentAt
//   unset, lastActivityAt older than 1h (shopper truly wandered off, not
//   mid-session), expiresAt in the future — and sends ONE consent-gated
//   "Restore your cart" email per draft, ever: reminderSentAt is stamped
//   after the send is attempted, so no draft is ever re-reminded
//   (including across provider outages).
//
// Anonymous-with-email carts qualify (no customerId requirement); a
// signed-in stamp only enriches the record.
//
// Response = summary counts only. No emails, session ids, or any other
// PII in the output.
//
// PATH DEPTH: app/api/cron/abandoned-carts/ = 4 `../` to repo root
// (same as app/api/cron/reconcile-payments/route.ts).
import { timingSafeEqual } from 'node:crypto';
import { getPayload } from 'payload';
import config from '../../../../payload.config';
import { sendAbandonedCartReminder } from '../../../../lib/email';

/** Cap per run: keep each tick bounded; the next tick mops up the rest. */
const BATCH_LIMIT = 50;
/** A draft is "abandoned" after this much silence. */
const IDLE_MS = 60 * 60 * 1000;

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

  if (!secret) {
    return new Response('cron misconfigured: missing CRON_SECRET', {
      status: 500,
    });
  }
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = await getPayload({ config });
  const now = new Date();

  const result = await payload.find({
    collection: 'cart-drafts',
    where: {
      and: [
        { status: { equals: 'active' } },
        { marketingConsent: { equals: true } },
        { reminderSentAt: { exists: false } },
        { lastActivityAt: { less_than: new Date(now.getTime() - IDLE_MS).toISOString() } },
        { expiresAt: { greater_than: now.toISOString() } },
      ],
    },
    // Local API defaults bypass access; depth 0 keeps relations as ids.
    overrideAccess: true,
    depth: 0,
    limit: BATCH_LIMIT,
    sort: '-lastActivityAt',
  });

  interface DraftDoc {
    id: string;
    sessionId: string;
    email?: string | null;
    items?: Array<{ name?: string | null }> | null;
  }

  let considered = 0;
  let sent = 0;
  let stamped = 0;
  let failed = 0;

  for (const doc of result.docs as DraftDoc[]) {
    considered++;
    // Email presence is enforced in code: the where layer cannot express
    // "non-empty string" portably across adapters.
    const to = doc.email?.trim();
    if (!to) continue;

    const productNames = (doc.items ?? [])
      .map((line) => (typeof line?.name === 'string' ? line.name : ''))
      .filter(Boolean);

    try {
      const attempted = await sendAbandonedCartReminder(
        to,
        { sessionId: doc.sessionId, items: doc.items ?? null },
        productNames,
      );
      if (!attempted) continue; // RESEND_API_KEY unset — do not burn the one reminder.
      sent++;
      await payload.update({
        collection: 'cart-drafts',
        id: doc.id,
        data: { reminderSentAt: now.toISOString() },
      });
      stamped++;
    } catch {
      // Never let one bad draft abort the batch.
      failed++;
    }
  }

  console.log(
    `[cron/abandoned-carts] considered=${considered} sent=${sent} stamped=${stamped} failed=${failed}`,
  );

  return new Response(
    JSON.stringify({
      status: 'ok',
      considered,
      sent,
      stamped,
      failed,
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
}
