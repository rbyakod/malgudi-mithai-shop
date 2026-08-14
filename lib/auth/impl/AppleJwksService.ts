// lib/auth/impl/AppleJwksService.ts
// Real Sign-in-with-Apple identity-token verifier — Task 15.3.
//
// Uses jose's createRemoteJWKSet, which fetches + caches Apple's public keys
// from https://appleid.apple.com/auth/keys and refreshes on key rotation
// (when a token's `kid` is unknown). Verification enforces:
//   - RS256 algorithm
//   - issuer == https://appleid.apple.com
//   - audience == our Services ID (APPLE_CLIENT_ID)
// jose v6's webapi build needs globalThis.crypto.subtle (Node 20+ / edge).
//
// This module is imported lazily by the container only when
// APPLE_AUTH_PROVIDER=apple, so tests that import the container never pay the
// jose/JWKS cost.
import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from "jose";
import type { AppleAuthService, AppleIdentity, AppleServerEvent } from "../AppleAuthService";

const APPLE_JWKS_URI = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";

export class AppleJwksService implements AppleAuthService {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly clientId: string;

  constructor(opts: { clientId: string }) {
    this.clientId = opts.clientId;
    this.jwks = createRemoteJWKSet(new URL(APPLE_JWKS_URI));
  }

  async verifyIdentityToken(identityToken: string): Promise<AppleIdentity> {
    const { payload } = await jwtVerify(identityToken, this.jwks, {
      algorithms: ["RS256"],
      issuer: APPLE_ISSUER,
      audience: this.clientId,
    });

    const sub = payload.sub;
    if (typeof sub !== "string" || sub.length === 0) {
      throw new joseErrors.JWTInvalid("identityToken missing sub claim");
    }

    const emailVerifiedRaw = (payload as { email_verified?: unknown }).email_verified;
    return {
      sub,
      email: typeof payload.email === "string" ? payload.email : null,
      emailVerified: emailVerifiedRaw === true || emailVerifiedRaw === "true",
    };
  }

  /** Task 20.5: server-to-server revocation events (POST /auth/events). */
  async verifyServerEventToken(token: string): Promise<AppleServerEvent[]> {
    const { payload } = await jwtVerify(token, this.jwks, {
      algorithms: ["RS256"],
      issuer: APPLE_ISSUER,
      audience: this.clientId,
    });
    const events = (payload as { events?: unknown }).events;
    if (!Array.isArray(events) || events.length === 0) {
      throw new joseErrors.JWTInvalid("server event token missing events claim");
    }
    return events as AppleServerEvent[];
  }
}
