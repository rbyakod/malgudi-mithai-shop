// lib/notifications/SmsService.ts
// SMS adapter interface — Task 5.2 (Mishran Mobile Apps v1).
//
// Transactional SMS for order status updates (confirmed/dispatched/
// out_for_delivery/delivered). MSG91 is the v1 impl; the interface mirrors
// the OtpService adapter convention so a vendor swap (e.g. Twilio, Gupshup)
// is a config + impl change.
//
// `templateKey` is the i18n key (e.g. 'sms.order.confirmed.body'). The impl
// resolves it to the provider's template ID via its own template map (env-
// driven per stage). `vars` is the variable substitution map (e.g. order id
// short form) — values are URL/JSON-escaped by the impl.

export interface SmsMessage {
  phone: string;
  templateKey: string;
  vars: Record<string, string>;
}

export interface SmsResult {
  messageId: string;
}

export interface SmsService {
  send(message: SmsMessage): Promise<SmsResult>;
}
