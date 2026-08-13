// lib/notifications/impl/FakeSmsService.ts
// In-memory fake SmsService — Task 5.2.
//
// Used in tests and when SMS_PROVIDER=fake / NODE_ENV=test. Records every
// call so tests can assert on the fan-out without hitting MSG91.

import type { SmsMessage, SmsResult, SmsService } from "../SmsService";

interface RecordedCall {
  phone: string;
  templateKey: string;
  vars: Record<string, string>;
}

export class FakeSmsService implements SmsService {
  readonly calls: RecordedCall[] = [];

  async send(message: SmsMessage): Promise<SmsResult> {
    this.calls.push({
      phone: message.phone,
      templateKey: message.templateKey,
      vars: { ...message.vars },
    });
    return { messageId: `fake-sms-${this.calls.length}` };
  }
}
