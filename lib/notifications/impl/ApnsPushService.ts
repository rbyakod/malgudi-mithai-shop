// lib/notifications/impl/ApnsPushService.ts
// APNs (Apple Push Notification service) adapter — Task 18.4, extended for
// Apple Wallet pass updates in Task 19.2.
//
// Three push types, all over APNs via the `@parse/node-apn` library:
//   1. sendToTokens  — `.alert` pushes (iOS alert notifications).
//   2. sendLiveActivityUpdate — `.liveactivity` content-state updates for the
//      Mishran delivery Live Activity + Dynamic Island (spec §8.8).
//   3. sendPassUpdate — `.pass` update pings for Apple Wallet loyalty passes
//      (Task 19.2). Empty aps payload; topic = pass type identifier.
//
// `@parse/node-apn` is a prod-only dependency, dynamically imported so that
// test + container import never fails when it is absent (same gating pattern
// as node-passbook). Without it, all methods throw a clear, actionable error
// and the container resolves `apnsService` to FakePushService — so a box
// without APNs credentials (awaiting Apple Developer Program enrollment — plan
// Open Question #8) never attempts an unreachable APNs call.
//
// APNs auth: `.p8` token-based auth (keyId + teamId + private key), the
// recommended modern auth over legacy `.p12` certs. The private key is read
// from env (`APNS_PRIVATE_KEY`, newlines restored) in v1.
//
// Adapter convention: throws raw Error on transport/init failures; the caller
// (OrderEventEmitter) logs + swallows so a notification outage never blocks an
// already-persisted order transition.

import type {
  PushMessage,
  PushResult,
  PushService,
  LiveActivityContentState,
  LiveActivityUpdateOptions,
  PassUpdateFields,
} from "../PushService";

export interface ApnsOptions {
  /** Apple Developer team ID (10 chars). */
  teamId: string;
  /** APNs auth key ID (10 chars). */
  keyId: string;
  /** APNs auth `.p8` private key (PEM body, `\n` escaped in env). */
  privateKey: string;
  /** App Bundle ID / topic for `.alert` + `.liveactivity` (e.g. com.mishran.app). */
  bundleId: string;
  /**
   * Apple Wallet pass type identifier — the APNs topic for `.pass` pushes
   * (e.g. pass.com.mishran.app). Falls back to `bundleId` when unset.
   */
  passTypeIdentifier?: string;
  /** true → production APNs gateway; false → sandbox/development. */
  production?: boolean;
}

// Epoch-seconds helper — APNs wants unix seconds, not ms.
const toEpochSeconds = (d: Date): number => Math.floor(d.getTime() / 1000);

export class ApnsPushService implements PushService {
  // Lazily-built provider; the dynamic import + Provider construction happen
  // on first send so module load never pays the @parse/node-apn cost.
  private providerPromise: Promise<unknown> | null = null;

  constructor(private readonly opts: ApnsOptions) {}

  private async getProvider(): Promise<{
    send: (
      notification: Record<string, unknown>,
      deviceToken: string,
    ) => Promise<{ sent?: boolean; failed?: unknown }>;
  }> {
    if (!this.providerPromise) {
      this.providerPromise = (async () => {
        const apnModule = "@parse/node-apn";
        let apn: {
          Provider: new (config: Record<string, unknown>) => unknown;
          Notification: new (config?: Record<string, unknown>) => unknown;
          pushType?: Record<string, string>;
        };
        try {
          // @vite-ignore + variable specifier defeat Vite's static
          // import-analysis (which would fail the transform before this
          // runtime try/catch runs) when the dep is absent in test.
          apn = (await import(/* @vite-ignore */ apnModule)) as typeof apn;
        } catch {
          throw new Error(
            "@parse/node-apn is not installed — install it and configure APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY to enable APNs push",
          );
        }
        const Provider = apn.Provider as unknown as new (config: Record<string, unknown>) => {
          send: (
            notification: Record<string, unknown>,
            deviceToken: string,
          ) => Promise<{ sent?: boolean; failed?: unknown }>;
        };
        return new Provider({
          token: {
            key: this.opts.privateKey,
            keyId: this.opts.keyId,
            teamId: this.opts.teamId,
          },
          production: this.opts.production ?? false,
        });
      })();
    }
    return this.providerPromise as Promise<ReturnType<ApnsPushService["getProvider"]>>;
  }

  async sendToTokens(message: PushMessage): Promise<PushResult> {
    const provider = await this.getProvider();
    const apnModule = "@parse/node-apn";
    const apn = (await import(/* @vite-ignore */ apnModule)) as {
      Notification: new (config?: Record<string, unknown>) => Record<string, unknown>;
    };

    const success: string[] = [];
    const failed: { token: string; reason: string }[] = [];

    for (const token of message.tokens) {
      const note = new apn.Notification({
        alert: { title: message.title, body: message.body },
        topic: this.opts.bundleId,
        pushType: "alert",
        payload: message.data,
      });
      try {
        const res = await provider.send(note, token);
        if (res && (res as { failed?: unknown }).failed) {
          failed.push({ token, reason: "apns rejected token" });
        } else {
          success.push(token);
        }
      } catch (err) {
        failed.push({ token, reason: err instanceof Error ? err.message : "unknown" });
      }
    }
    return { success, failed };
  }

  async sendLiveActivityUpdate(
    deviceToken: string,
    contentState: LiveActivityContentState,
    options?: LiveActivityUpdateOptions,
  ): Promise<void> {
    const provider = await this.getProvider();
    const apnModule = "@parse/node-apn";
    const apn = (await import(/* @vite-ignore */ apnModule)) as {
      Notification: new (config?: Record<string, unknown>) => Record<string, unknown>;
    };

    // `.liveactivity` push: content-state drives the ActivityKit widget;
    // stale-date dims stale content; dismissal-date ends the activity
    // (delivered/cancelled). priority normal (5) for content updates.
    const updatedAt = new Date(contentState.updatedAt);
    const staleDate = options?.staleDate ?? new Date(updatedAt.getTime() + 60 * 60 * 1000);

    const noteConfig: Record<string, unknown> = {
      topic: this.opts.bundleId,
      pushType: "liveactivity",
      priority: 5,
      payload: {
        "content-state": contentState,
      },
      staleDate: toEpochSeconds(staleDate),
    };
    if (options?.dismissalDate) {
      // dismissal-date ends the Live Activity on the device (spec §8.8 step 5).
      noteConfig.payload = {
        ...(noteConfig.payload as Record<string, unknown>),
        "dismissal-date": toEpochSeconds(options.dismissalDate),
      };
    }

    const note = new apn.Notification(noteConfig);
    await provider.send(note, deviceToken);
  }

  async sendPassUpdate(
    deviceToken: string,
    _serialNumber: string,
    _fields?: PassUpdateFields,
  ): Promise<void> {
    const provider = await this.getProvider();
    const apnModule = "@parse/node-apn";
    const apn = (await import(/* @vite-ignore */ apnModule)) as {
      Notification: new (config?: Record<string, unknown>) => Record<string, unknown>;
    };

    // Apple Wallet `.pass` update push: empty aps payload (Apple requirement —
    // any alert/body/sound is rejected for pushType "pass"), topic = the pass
    // type identifier. The device receives this silent ping and re-fetches the
    // pass from the Wallet webServiceURL. The refreshed face values
    // (`_fields` — new balance/tier) are NOT carried over APNs; they are
    // recorded by the Fake for test assertions + used by the emitter to decide
    // whether a push is warranted. `_serialNumber` identifies the pass for logs.
    const note = new apn.Notification({
      topic: this.opts.passTypeIdentifier ?? this.opts.bundleId,
      pushType: "pass",
    });
    await provider.send(note, deviceToken);
  }
}
