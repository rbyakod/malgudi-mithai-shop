// lib/notifications/impl/FakePushService.ts
// In-memory fake PushService — Task 5.2, extended for Live Activity (Task 18.4).
//
// Used in tests and when PUSH_PROVIDER=fake / NODE_ENV=test. Records every
// call so tests can assert on the fan-out without mocking firebase-admin or
// @parse/node-apn. Doubles as the container's `apnsService` fallback when
// APNs creds are absent — its liveActivityCalls let integration tests verify
// the OrderEventEmitter fires the right content-state.

import type {
  PushMessage,
  PushResult,
  PushService,
  LiveActivityContentState,
  LiveActivityUpdateOptions,
} from "../PushService";

interface RecordedCall {
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface RecordedLiveActivityUpdate {
  deviceToken: string;
  contentState: LiveActivityContentState;
  options?: LiveActivityUpdateOptions;
}

export class FakePushService implements PushService {
  readonly calls: RecordedCall[] = [];
  readonly liveActivityCalls: RecordedLiveActivityUpdate[] = [];

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

  async sendLiveActivityUpdate(
    deviceToken: string,
    contentState: LiveActivityContentState,
    options?: LiveActivityUpdateOptions,
  ): Promise<void> {
    this.liveActivityCalls.push({ deviceToken, contentState, options });
  }
}
