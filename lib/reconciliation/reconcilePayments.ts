// lib/reconciliation/reconcilePayments.ts
// Reconciliation cron — Task 4.7 (Mishran Mobile Apps v1).
//
// Catches ORPHAN payments: a payment row was created at our side when
// Razorpay accepted our create-order, but the client then abandoned,
// closed the app, lost network, etc. — so neither the verify route nor
// the webhook ever fired. The payment row stays in `created` forever
// unless we reconcile.
//
// CADENCE: every 15 minutes (Vercel cron — see vercel.ts).
// CUTTOFF: 15 minutes. Rationale: the webhook gets one full cron cycle
//   (15min) to land before reconcile second-guesses Razorpay. Without
//   this grace, we'd race the webhook constantly. If the webhook is
//   genuinely lost, we settle on the next tick.
//
// FLOW per stale payment:
//   1. Query Payload: payments where status='created' AND createdAt < cutoff.
//   2. For each, ask Razorpay for the authoritative order status
//      (fetchStatusByOrder). We use the ORDER id, not the payment id —
//      orphan rows have no providerPaymentId locally because verify
//      never ran.
//   3. If Razorpay says `captured`: update payment row, backfill the
//      providerPaymentId, mark order paid, transition order -> confirmed.
//   4. If Razorpay says `failed`: update payment row only. Order stays
//      in pending_payment; a future cart retry will create a fresh order.
//   5. If Razorpay says `created` (still pending): no-op. Next tick.
//   6. fetchStatusByOrder throws: log + continue. Other payments still
//      processed.
//
// IDEMPOTENCY: there's a race window — between our query and the per-row
//   update, the webhook could land and transition the order to confirmed.
//   transition() throws INVALID_STATE_TRANSITION in that case; we catch
//   it specifically and treat it as success (the end state we wanted).
//   The payment-row status check inside the loop is the other guard: if
//   the webhook already captured it, skip entirely.
//
// BRIEF FIXES applied:
//   - #1 Path depth wrong in brief (4 ../) — fixed in route file.
//   - #2 `await container.paymentService` was wrong (container wires
//     sync). Use container.paymentService.fetchStatusByOrder directly.
//   - #3 dynamic `await import('../commerce/impl/PayloadOrderService')`
//     replaced with static import.
//   - #4 Brief step 3 "commit" with no tests — tests added.
//   - #5 Per-payment errors now logged via container.logger with
//     paymentId + providerOrderId + message.
//   - #6 Cutoff extracted to RECONCILE_CUTOFF_MS named const.
//   - #7 Cron auth uses timingSafeEqual (see route file).
//   - #9 INVALID_STATE_TRANSITION caught + treated as success (race).
//   - #10 CORRECTED THE PROVIDER FIELD. Brief passed providerOrderId to
//     fetchStatus (which takes providerPaymentId). The orphan case has
//     only providerOrderId locally, so we added PaymentService
//     .fetchStatusByOrder to query Razorpay by order id. Without this
//     fix the brief's code would have crashed at runtime.
import { getPayload } from 'payload';
import config from '../../payload.config';
import { container } from '../container';
import { PayloadOrderService } from '../commerce/impl/PayloadOrderService';
import { ApiError, ErrorCode } from '../api/errors';

/**
 * Cutoff: only reconcile payments older than this many milliseconds.
 * Matches the cron cadence so the webhook gets one full cycle to land
 * before we second-guess Razorpay. Tunable for ops (no other code change
 * needed) but intentionally a const rather than env — changing it without
 * changing the cron schedule would either race the webhook (shorter) or
 * delay orphan settlement (longer).
 */
export const RECONCILE_CUTOFF_MS = 15 * 60 * 1000;

/**
 * Page size for the stale-payment query. Bounded so a runaway orphan
 * backlog can't OOM the cron invocation — at 15-min cadence with even
 * 1k orphan payments we'd catch up in ~10 ticks. Raise if real traffic
 * ever exceeds this per cycle.
 */
const RECONCILE_PAGE_SIZE = 100;

export interface ReconcileResult {
  inspected: number;
  captured: number;
  failed: number;
  pending: number;
  errors: number;
}

/**
 * Reconcile stale `created` payments against the payment provider.
 *
 * Designed to be invoked by the /api/cron/reconcile-payments route on a
 * 15-min schedule (Vercel cron) or by any external scheduler hitting the
 * same endpoint (self-hosted). Safe to call in parallel — all updates
 * are idempotent (see file header).
 */
export async function reconcilePayments(): Promise<ReconcileResult> {
  const payload = await getPayload({ config });
  const cutoff = new Date(Date.now() - RECONCILE_CUTOFF_MS);
  const orderService = new PayloadOrderService();
  const log = container.logger;

  const stale = await payload.find({
    collection: 'payments',
    where: {
      status: { equals: 'created' },
      createdAt: { less_than: cutoff.toISOString() },
    },
    limit: RECONCILE_PAGE_SIZE,
  });

  const result: ReconcileResult = {
    inspected: 0,
    captured: 0,
    failed: 0,
    pending: 0,
    errors: 0,
  };

  for (const doc of stale.docs) {
    const payment = doc as {
      id: string;
      orderId: string | { id?: string };
      providerOrderId?: string;
      providerPaymentId?: string;
      status?: string;
    };
    result.inspected += 1;

    if (!payment.providerOrderId) {
      // Payment row was created without a providerOrderId — only possible
      // if create-order failed mid-write or a future cash-on-delivery
      // flow co-opts this collection. Nothing to reconcile against; skip.
      log.warn(
        {
          paymentId: payment.id,
          orderId: String(payment.orderId),
        },
        'reconcile.skip: missing providerOrderId',
      );
      result.pending += 1;
      continue;
    }

    let providerStatus: 'created' | 'failed' | 'captured' | string;
    let providerPaymentId: string | undefined;
    try {
      const fetched = await container.paymentService.fetchStatusByOrder(
        payment.providerOrderId,
      );
      providerStatus = fetched.status;
      providerPaymentId = fetched.providerPaymentId;
    } catch (e) {
      result.errors += 1;
      log.error(
        {
          paymentId: payment.id,
          providerOrderId: payment.providerOrderId,
          orderId: String(payment.orderId),
          err: e instanceof Error ? e.message : String(e),
        },
        'reconcile.fetchStatusByOrder failed',
      );
      continue;
    }

    if (providerStatus === 'created') {
      // Razorpay agrees the payment is still pending — leave the row
      // alone and let the next tick try again.
      result.pending += 1;
      continue;
    }

    if (providerStatus !== 'captured' && providerStatus !== 'failed') {
      // refunded / partially_refunded on a 'created' local row is a
      // provider-side state our local state machine can't represent
      // directly. Log + leave for ops; do not auto-transition.
      result.pending += 1;
      log.warn(
        {
          paymentId: payment.id,
          providerOrderId: payment.providerOrderId,
          providerStatus,
        },
        'reconcile.skip: unexpected provider status for created row',
      );
      continue;
    }

    // Re-read to guard against the webhook landing between our find and
    // this update. If the row is no longer 'created', someone else won
    // the race — leave it.
    const reloaded = await payload.findByID({
      collection: 'payments',
      id: payment.id,
    });
    const current = (reloaded as { status?: string }).status;
    if (current !== 'created') {
      log.info(
        {
          paymentId: payment.id,
          currentStatus: current,
        },
        'reconcile.skip: row changed since query (race with webhook)',
      );
      result.pending += 1;
      continue;
    }

    // Update the payment row. Backfill providerPaymentId if we got one.
    await payload.update({
      collection: 'payments',
      id: payment.id,
      data: {
        status: providerStatus,
        ...(providerPaymentId ? { providerPaymentId } : {}),
      },
    });

    if (providerStatus === 'failed') {
      result.failed += 1;
      log.info(
        {
          paymentId: payment.id,
          providerOrderId: payment.providerOrderId,
        },
        'reconcile.marked: failed',
      );
      continue;
    }

    // providerStatus === 'captured'
    const orderId = String(payment.orderId);
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: { paymentStatus: 'paid' },
    });

    // transition() will throw INVALID_STATE_TRANSITION if the order has
    // already moved past pending_payment (webhook won the race between
    // our row-update above and this call). That's the success end-state
    // we wanted — catch and treat as captured.
    try {
      await orderService.transition(orderId, 'confirmed', {
        actor: 'system:reconcile',
      });
    } catch (e) {
      if (e instanceof ApiError && e.code === ErrorCode.INVALID_STATE_TRANSITION) {
        log.info(
          {
            paymentId: payment.id,
            orderId,
          },
          'reconcile.transition: order already past pending_payment (race)',
        );
      } else {
        // Re-throw unexpected errors after marking the row + order paid —
        // operator should investigate. Capture in result so caller knows.
        result.errors += 1;
        log.error(
          {
            paymentId: payment.id,
            orderId,
            err: e instanceof Error ? e.message : String(e),
          },
          'reconcile.transition: unexpected error',
        );
        continue;
      }
    }

    result.captured += 1;
    log.info(
      {
        paymentId: payment.id,
        providerOrderId: payment.providerOrderId,
        orderId,
      },
      'reconcile.marked: captured',
    );
  }

  log.info(
    {
      inspected: result.inspected,
      captured: result.captured,
      failed: result.failed,
      pending: result.pending,
      errors: result.errors,
    },
    'reconcile.summary',
  );

  return result;
}
