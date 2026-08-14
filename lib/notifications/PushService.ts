// lib/notifications/PushService.ts
// Push notification adapter interface — Task 5.2 (Mishran Mobile Apps v1),
// extended for iOS Live Activity in Task 18.4 and Apple Wallet pass updates
// in Task 19.2.
//
// Three concerns:
//   1. `sendToTokens` — multicast alert push. Callers pass a list of device
//      tokens (one per registered Device row) and the impl fans out to the
//      underlying provider (FCM for Android in v1). Partial failures are
//      surfaced per token; the caller decides whether to log/retry/deactivate.
//   2. `sendLiveActivityUpdate` (Task 18.4) — iOS-only. Updates an in-flight
//      Live Activity (delivery tracker) via an APNs `.liveactivity` push
//      carrying `content-state` + `stale-date`. The ActivityKit push token is
//      device-scoped and distinct from the alert pushToken; only iOS devices
//      that have started a Live Activity carry one. `dismissalDate` ends the
//      activity (delivered/cancelled) per spec §8.8.
//   3. `sendPassUpdate` (Task 19.2) — iOS-only. Pings a device that has an
//      Apple Wallet loyalty pass added, via an APNs `.pass` push with an empty
//      `aps` payload, so the device re-fetches the refreshed pass face. The
//      token is registered per-pass (WalletPasses.devices[]), not per-Device.
//
// Adapter pattern: a future SNS/Expo impl satisfies the same interface; the
// DI container + OrderEventEmitter stay unchanged on a vendor swap. Note
// Live Activity + Wallet pass updates are iOS-only — the FCM impl's
// sendLiveActivityUpdate / sendPassUpdate are documented no-ops; the real
// work happens in ApnsPushService.
//
// `data` is the custom key/value payload delivered to the client. Keep
// values string-typed — FCM requires string values, and the client resolves
// the title/body i18n keys against packages/i18n-strings.

export interface PushMessage {
  tokens: string[];
  // v1: ship i18n keys as the title/body; client resolves via
  // packages/i18n-strings. TODO(v2): server-render via i18n-strings +
  // customer.locale when locale-aware push lands.
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface PushResult {
  success: string[];
  failed: { token: string; reason: string }[];
}

/**
 * Content-state for the Mishran delivery Live Activity (spec §8.8).
 * Mirrors the iOS `DeliveryActivityAttributes.ContentState` struct — the
 * ActivityKit widget renders these fields on the lock screen + Dynamic
 * Island. `statusLabel`/`body` ship as i18n keys (matching the v1 alert-push
 * strategy); the client resolves against packages/i18n-strings + device locale.
 */
export interface LiveActivityContentState {
  /** Order stage key (confirmed/packed/dispatched/out_for_delivery/delivered). */
  status: string;
  /** i18n key for the milestone label. */
  statusLabel: string;
  /** i18n key for the detail body. */
  body: string;
  /** ISO timestamp of this update. */
  updatedAt: string;
}

export interface LiveActivityUpdateOptions {
  /** When the content goes stale (UI dims). Defaults to updatedAt + 1h. */
  staleDate?: Date;
  /** Ends the Live Activity (delivered/cancelled). Per spec §8.8 step 5. */
  dismissalDate?: Date;
}

/**
 * Refreshed pass-face fields for an Apple Wallet loyalty-pass update
 * (Task 19.2). These are NOT carried in the APNs payload — Apple requires a
 * `.pass` push to have an empty `aps` body; the device re-fetches the updated
 * pass from the Wallet webServiceURL. They are recorded by the Fake for test
 * assertions and used by the emitter to decide whether a push is warranted.
 */
export interface PassUpdateFields {
  tier?: "silver" | "gold";
  holderName?: string;
  /** New loyalty balance / delivered-order count shown on the pass face. */
  balanceLabel?: string;
}

export interface PushService {
  sendToTokens(message: PushMessage): Promise<PushResult>;
  /**
   * Push a `.liveactivity` content-state update to a single ActivityKit token.
   * iOS-only; the FCM impl is a no-op. Throws on transport failure — the
   * caller (OrderEventEmitter) wraps in try/catch so a Live Activity outage
   * never blocks an order transition.
   */
  sendLiveActivityUpdate(
    deviceToken: string,
    contentState: LiveActivityContentState,
    options?: LiveActivityUpdateOptions,
  ): Promise<void>;
  /**
   * Push an Apple Wallet `.pass` update ping to one device token registered for
   * a pass (Task 19.2). The `aps` payload is empty (Apple requirement); the
   * device re-fetches the refreshed pass face from the Wallet webServiceURL.
   * `serialNumber` identifies the pass; `fields` are the new face values
   * (recorded by the Fake, not sent over APNs). iOS-only; the FCM impl is a
   * no-op (Google Wallet uses a separate mechanism, out of scope for v1).
   * Throws on transport failure; the caller wraps in try/catch.
   */
  sendPassUpdate(
    deviceToken: string,
    serialNumber: string,
    fields?: PassUpdateFields,
  ): Promise<void>;
}
