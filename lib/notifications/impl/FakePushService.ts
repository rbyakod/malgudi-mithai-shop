// lib/notifications/impl/FakePushService.ts
// In-memory fake PushService — Task 5.2.
//
// Used in tests and when PUSH_PROVIDER=fake / NODE_ENV=test. Records every
// call so tests can assert on the fan-out without mocking firebase-admin.

import type { PushMessage, PushResult, PushService } from "../PushService";

interface RecordedCall {
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}

export class FakePushService implements PushService {
  readonly calls: RecordedCall[] = [];

  async sendToTokens(message: PushMessage): Promise<PushResult> {
    this.calls.push({
      tokens: [...message.tokens],
      title: message.title,
      body: message.body,
      data: { ...message.data },
    });
    // Pretend every token succeeded — tests asserting on failure paths can
    // construct their own fake or spy on the mock directly.
    return {
      success: [...message.tokens],
      failed: [],
    };
  }
}
