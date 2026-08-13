// lib/notifications/impl/FcmPushService.ts
// FCM (Firebase Cloud Messaging) push adapter — Task 5.2.
//
// Uses firebase-admin's multicast send: one API call fans the message out
// to every device token. Per-token failures are surfaced in the result so
// the caller (OrderEventEmitter) can log them and, in a later task,
// deactivate stale device rows (e.g. on 'registration-token-not-registered').
//
// Credential resolution mirrors the standard firebase-admin pattern:
//   - serviceAccountJson (stringified JSON) -> credential.cert()
//   - otherwise -> credential.applicationDefault() (ADC; works on GCP and
//     via `gcloud auth application-default login` locally)
//
// Init is idempotent: if firebase-admin already has a default app (e.g. the
// container wired two services that both import firebase-admin, or a hot
// reload re-ran module init), we reuse apps[0].
//
// Adapter convention: throws raw Error on transport/init failures; callers
// wrap into ApiError at the route boundary.

import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
  type App,
  type ServiceAccount,
} from "firebase-admin";
// v14 split messaging into a subpath export; the modular getMessaging(app)
// replaces the old app.messaging() namespace method.
import { getMessaging } from "firebase-admin/messaging";
import type { PushMessage, PushResult, PushService } from "../PushService";

export class FcmPushService implements PushService {
  private app: App;

  constructor(deps: { projectId: string; serviceAccountJson?: string }) {
    // Reuse the default app if one is already initialized. Important for
    // Next.js dev hot-reload and for tests that construct the service twice.
    this.app =
      (getApps()[0] as App | undefined) ??
      initializeApp({
        credential: deps.serviceAccountJson
          ? cert(JSON.parse(deps.serviceAccountJson) as ServiceAccount)
          : applicationDefault(),
        projectId: deps.projectId,
      });
  }

  async sendToTokens(message: PushMessage): Promise<PushResult> {
    const response = await getMessaging(this.app).sendEachForMulticast({
      notification: { title: message.title, body: message.body },
      data: message.data,
      tokens: message.tokens,
    });

    const success: string[] = [];
    const failed: { token: string; reason: string }[] = [];
    response.responses.forEach((r: { success: boolean; error?: { message?: string } }, i: number) => {
      const token = message.tokens[i];
      if (r.success) {
        success.push(token);
      } else {
        failed.push({ token, reason: r.error?.message ?? "unknown" });
      }
    });
    return { success, failed };
  }
}
