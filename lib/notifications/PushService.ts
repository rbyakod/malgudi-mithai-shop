// lib/notifications/PushService.ts
// Push notification adapter interface — Task 5.2 (Mishran Mobile Apps v1).
//
// Single method, multicast semantics: callers pass a list of device tokens
// (one per registered Device row for the customer) and the impl fans out to
// the underlying provider (FCM in v1). Partial failures are surfaced per
// token — the caller decides whether to log, retry, or deactivate the
// device row.
//
// Adapter pattern: a future SNS/Expo impl satisfies the same interface;
// the DI container + OrderEventEmitter stay unchanged on a vendor swap.
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

export interface PushService {
  sendToTokens(message: PushMessage): Promise<PushResult>;
}
