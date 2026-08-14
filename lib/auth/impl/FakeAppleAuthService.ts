// lib/auth/impl/FakeAppleAuthService.ts
// Test fake for Sign-in-with-Apple — Task 15.3.
//
// The route + upsert + replay-guard logic is the load-bearing unit surface;
// real RS256/JWKS crypto is jose's responsibility (exercised in
// AppleJwksService via a nock'd JWKS in a dedicated integration test, not
// here). This fake decodes a fixture JWT's middle segment as base64 JSON so a
// test can craft tokens with arbitrary claims (sub/email/email_verified) and
// assert on the route's handling. Malformed input throws to drive the 401 path.
import type { AppleAuthService, AppleIdentity, AppleServerEvent } from "../AppleAuthService";

export class FakeAppleAuthService implements AppleAuthService {
  async verifyIdentityToken(identityToken: string): Promise<AppleIdentity> {
    const claims = decodeFixtureClaims(identityToken, "identity token");
    const sub = claims.sub;
    if (typeof sub !== "string" || sub.length === 0) {
      throw new Error("identity token missing sub");
    }
    const ev = claims.email_verified;
    return {
      sub,
      email: typeof claims.email === "string" ? claims.email : null,
      emailVerified: ev === true || ev === "true",
    };
  }

  /** Task 20.5: fixture server-event JWT → events array (no crypto). */
  async verifyServerEventToken(token: string): Promise<AppleServerEvent[]> {
    const claims = decodeFixtureClaims(token, "event token");
    const events = claims.events;
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error("event token missing events");
    }
    return events as AppleServerEvent[];
  }
}

/** Shared fixture decoding: base64url payload segment → JSON claims. */
function decodeFixtureClaims(
  token: string,
  what: string,
): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error(`malformed ${what}`);
  }
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Error(`malformed ${what}`);
  }
}

/**
 * Build a fixture identityToken (unsigned, header.payload.sig) the fake will
 * accept. Only the payload is meaningful; tests craft claims here.
 */
export function fixtureAppleToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "fake" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.fake-signature`;
}
