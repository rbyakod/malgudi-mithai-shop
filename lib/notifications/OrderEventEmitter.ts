// lib/notifications/OrderEventEmitter.ts
// Order lifecycle event fan-out — Task 5.2 (Mishran Mobile Apps v1).
//
// Called by every path that transitions an order to a notifiable stage:
//   - app/api/mobile/v1/payments/razorpay/verify/route.ts   (confirmed)
//   - app/api/webhooks/razorpay/route.ts                     (confirmed)
//   - app/api/mobile/v1/orders/cod/route.ts                  (confirmed — born-confirmed COD orders never reach verify/webhook)
//   - app/api/admin/orders/[id]/status/route.ts              (any stage)
//
// For each stage in TEMPLATE_BY_STAGE, the emitter:
//   1. Loads the order (no-op if missing — covers race where webhook fires
//      before order row is fully written).
//   2. Resolves the template for the stage (no-op for unknown stages).
//   3. Loads the customer + their active devices; fans push out via
//      container.pushService (FCM in v1) when devices exist.
//   4. If the stage is SMS-enabled and the customer has a phone, sends the
//      SMS via container.smsService (MSG91 in v1).
//
// Fault tolerance: each channel is wrapped in try/catch. The transition has
// already persisted; a notification failure MUST NOT bubble back into the
// route. Failures are logged via container.logger.
//
// i18n: v1 ships the i18n KEYS (push.order.<stage>.title/body) as the title
// and body strings. The mobile client resolves them via packages/i18n-
// strings against the device locale. TODO(v2): server-render via i18n-
// strings + customer.locale when locale-aware push lands.
//
// event_id: a fresh UUID per emission, passed in the push data payload so
// the client can dedupe (e.g. if webhook + client verify both fire the
// confirmed event, the client may receive two pushes — different event_ids
// but same orderId+stage; client treats them as one transition).
//
// Analytics: brief referenced container.analyticsService.track(...); that
// service does not exist yet. TODO(later): wire analyticsService.track(
//   'order_status_changed', { order_id, to_status }).

import { getPayload } from "payload";
import config from "../../payload.config";
import { container } from "../container";
import { tierForDeliveredCount, loyaltySerialNumber } from "../loyalty/eligibility";

interface StageTemplate {
  titleKey: string;
  bodyKey: string;
  sms?: boolean;
}

const TEMPLATE_BY_STAGE: Record<string, StageTemplate> = {
  confirmed: { titleKey: "push.order.confirmed.title", bodyKey: "push.order.confirmed.body", sms: true },
  packed: { titleKey: "push.order.packed.title", bodyKey: "push.order.packed.body" },
  dispatched: { titleKey: "push.order.dispatched.title", bodyKey: "push.order.dispatched.body", sms: true },
  out_for_delivery: {
    titleKey: "push.order.out_for_delivery.title",
    bodyKey: "push.order.out_for_delivery.body",
    sms: true,
  },
  delivered: { titleKey: "push.order.delivered.title", bodyKey: "push.order.delivered.body", sms: true },
};

export async function emitOrderEvent(orderId: string, stage: string): Promise<void> {
  const template = TEMPLATE_BY_STAGE[stage];
  if (!template) return;

  const payload = await getPayload({ config });

  // depth: 0 keeps customerId an id string — at the default depth Payload
  // populates the relation into an object, String() of which is
  // "[object Object]" and every downstream customer lookup 404s.
  const order = (await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
  })) as { id: string; customerId: string | number } | null;
  if (!order) return;

  const customerId = String(order.customerId);

  // Customer + devices could be fetched in parallel — kept sequential so a
  // missing customer (rare; FK should prevent it) doesn't crash device
  // lookup.
  const customer = (await payload.findByID({
    collection: "customers",
    id: customerId,
  })) as { phone?: string; locale?: string } | null;
  if (!customer) return;

  const devices = await payload.find({
    collection: "devices",
    where: { and: [{ customerId: { equals: customerId } }, { active: { equals: true } }] },
    limit: 10,
  });
  const deviceDocs = devices.docs as Array<{
    pushToken?: string;
    platform?: string;
    liveActivityToken?: string;
  }>;
  const tokens = deviceDocs
    .map((d) => d.pushToken)
    .filter((t): t is string => typeof t === "string" && t.length > 0);

  const eventId = crypto.randomUUID();
  const data: Record<string, string> = { orderId, stage, event_id: eventId };

  if (tokens.length > 0) {
    try {
      await container.pushService.sendToTokens({
        tokens,
        title: template.titleKey,
        body: template.bodyKey,
        data,
      });
    } catch (err) {
      // Logged + swallowed — see header. Order transition already persisted.
      container.logger.error(
        { err, orderId, stage, eventId, channel: "push" },
        "emitOrderEvent push failed",
      );
    }
  }

  // --- Live Activity update (Task 18.4) ---------------------------------
  // iOS devices that have started a delivery Live Activity carry an
  // ActivityKit push token. Each gets a `.liveactivity` content-state update
  // via container.apnsService. The activity ends (dismissal-date) when the
  // order reaches a terminal stage (spec §8.8 step 5).
  const liveActivityDevices = deviceDocs.filter(
    (d) =>
      d.platform === "ios" &&
      typeof d.liveActivityToken === "string" &&
      d.liveActivityToken.length > 0,
  );
  if (liveActivityDevices.length > 0) {
    // 'delivered' ends the activity. NOTE: 'cancelled' is a side-state not in
    // TEMPLATE_BY_STAGE (the emitter returns early for it); a cancelled-order
    // Live Activity dismissal would need its own emission path — deferred.
    const isTerminal = stage === "delivered";
    const updatedAt = new Date().toISOString();
    const contentState = {
      status: stage,
      statusLabel: template.titleKey,
      body: template.bodyKey,
      updatedAt,
    };
    for (const device of liveActivityDevices) {
      try {
        await container.apnsService.sendLiveActivityUpdate(
          device.liveActivityToken as string,
          contentState,
          isTerminal ? { dismissalDate: new Date(updatedAt) } : undefined,
        );
      } catch (err) {
        container.logger.error(
          { err, orderId, stage, eventId, channel: "live-activity", token: device.liveActivityToken },
          "emitOrderEvent live-activity update failed",
        );
      }
    }
  }

  if (template.sms && customer.phone) {
    try {
      await container.smsService.send({
        phone: customer.phone,
        templateKey: template.bodyKey,
        vars: { id: orderId.slice(-8) },
      });
    } catch (err) {
      container.logger.error(
        { err, orderId, stage, eventId, channel: "sms" },
        "emitOrderEvent sms failed",
      );
    }
  }

  // --- Loyalty eligibility (Task 19.1) + Wallet pass refresh (Task 19.2) --
  // On a delivered order, proactively mint the customer's Apple Wallet
  // loyalty pass if they just crossed the Silver threshold (≥2 delivered)
  // and no active pass row exists yet. The on-demand GET /account/loyalty-
  // pass route is the primary path; this is a convenience so the pass exists
  // before the user opens Wallet. Guarded by walletPassService presence (the
  // emitter's test container omits it) + try/catch so a wallet outage never
  // blocks an already-persisted transition. Gold upgrade is left to the route
  // (re-generation is cheap + idempotent on serial).
  //
  // When a pass is already in Wallet with registered devices, the same
  // delivered hook fires an APNs `.pass` push (Task 19.2) so each device
  // re-fetches the refreshed pass face (new balance / tier). Guarded by
  // apnsService presence + per-device try/catch.
  if (stage === "delivered" && container.walletPassService) {
    try {
      const delivered = await payload.find({
        collection: "orders",
        where: {
          and: [{ customerId: { equals: customerId } }, { status: { equals: "delivered" } }],
        },
        limit: 0,
      });
      const deliveredCount = delivered.totalDocs ?? 0;
      const tier = tierForDeliveredCount(deliveredCount);
      if (tier) {
        const existingPass = await payload.find({
          collection: "walletPasses",
          where: { and: [{ customerId: { equals: customerId } }, { active: { equals: true } }] },
          limit: 1,
        });
        const passRow = existingPass.docs[0] as
          | { id: string; serialNumber: string; devices?: Array<{ pushToken?: string }> }
          | undefined;

        if (!passRow) {
          // Proactive mint (Task 19.1): no pass yet, generate one. A freshly
          // minted pass has no registered Wallet devices, so no `.pass` push.
          const serialNumber = loyaltySerialNumber(customerId);
          await container.walletPassService.createSignedPassUrl({
            serialNumber,
            tier,
            holderName: (customer as { name?: string }).name ?? undefined,
            balanceLabel: String(deliveredCount),
          });
          await payload.create({
            collection: "walletPasses",
            data: { customerId, serialNumber, tier, active: true },
          });
        }

        // --- Wallet pass refresh (Task 19.2) ----------------------------
        // A pass already added to Apple Wallet carries registered device
        // tokens (WalletPasses.devices[]). Ping each with an APNs `.pass` push
        // so the device re-fetches the refreshed pass face (new balance / tier
        // from this delivery).
        if (passRow && container.apnsService) {
          for (const dev of passRow.devices ?? []) {
            const token = dev.pushToken;
            if (!token) continue;
            try {
              await container.apnsService.sendPassUpdate(token, passRow.serialNumber, {
                balanceLabel: String(deliveredCount),
                tier,
              });
            } catch (err) {
              container.logger.error(
                { err, orderId, stage, eventId, channel: "pass-push", token },
                "emitOrderEvent .pass push failed",
              );
            }
          }
        }
      }
    } catch (err) {
      container.logger.error(
        { err, orderId, stage, eventId, channel: "loyalty" },
        "emitOrderEvent proactive loyalty pass failed",
      );
    }
  }

  // TODO(later): analyticsService.track('order_status_changed',
  //   { order_id: orderId, to_status: stage }). Wired when the analytics
  //   adapter (MultiAnalyticsService) lands.
}
