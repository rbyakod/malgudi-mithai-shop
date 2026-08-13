// lib/notifications/PushService.ts
// Push notification adapter interface — Task 5.2 (Mishran Mobile Apps v1),
// extended for iOS Live Activity in Task 18.4.
//
// Two concerns:
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
//
// Adapter pattern: a future SNS/Expo impl satisfies the same interface; the
// DI container + OrderEventEmitter stay unchanged on a vendor swap. Note
// Live Activity is iOS-only — the FCM impl's sendLiveActivityUpdate is a
// documented no-op (Android has no Live Activity); the real work happens in
// ApnsPushService.
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
}
