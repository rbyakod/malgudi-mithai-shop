// lib/notifications/OrderEventEmitter.ts
// Order lifecycle event fan-out — Task 5.2 (Mishran Mobile Apps v1).
//
// Called by every path that transitions an order to a notifiable stage:
//   - app/api/mobile/v1/payments/razorpay/verify/route.ts   (confirmed)
//   - app/api/webhooks/razorpay/route.ts                     (confirmed)
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

  const order = (await payload.findByID({ collection: "orders", id: orderId })) as
    | { id: string; customerId: string | number }
    | null;
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
  const tokens = devices.docs
    .map((d) => (d as { pushToken?: string }).pushToken)
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

  // TODO(later): analyticsService.track('order_status_changed',
  //   { order_id: orderId, to_status: stage }). Wired when the analytics
  //   adapter (MultiAnalyticsService) lands.
}
