// lib/auth/AppleAuthService.ts
// Sign-in-with-Apple identity-token verification — Task 15.3.
//
// The iOS client obtains an `identityToken` (a signed RS256 JWT) from
// ASAuthorizationAppleIDCredential. We verify it against Apple's public JWKS
// and extract the stable `sub`, `email`, and `email_verified` claims to upsert
// a customer without an OTP/phone round-trip.
//
// Adapter pattern: AppleJwksService is the real impl (jose remote JWKS +
// cached key set); FakeAppleAuthService decodes fixture tokens for unit tests.
// The DI container selects between them via APPLE_AUTH_PROVIDER.

export interface AppleIdentity {
  /** App-scoped, stable Apple user id (`sub` claim). */
  sub: string;
  /** Email at first authorization (Apple may return null on re-auth). */
  email?: string | null;
  /** Whether Apple marked the email verified (`email_verified` claim). */
  emailVerified?: boolean;
}

/** Apple server-to-server event (the `events` array Apple POSTs to /auth/events). */
export interface AppleServerEvent {
  /** "consent-revoked" | "email-disabled" | "email-relay-change". */
  type: string;
  /** Apple user id — matches a customer's appleSub. */
  sub?: string;
}

export interface AppleAuthService {
  /**
   * Verify a Sign-in-with-Apple identityToken. Throws on malformed signature,
   * wrong issuer/audience, or expired token — the route maps these to 401.
   */
  verifyIdentityToken(identityToken: string): Promise<AppleIdentity>;

  /**
   * Verify Apple's server-to-server revocation JWT (POST /auth/events).
   * Same JWKS + issuer/audience rules as identity tokens; returns the
   * decoded `events` array. Throws on anything malformed — the webhook
   * maps that to 401 so Apple retries.
   */
  verifyServerEventToken(token: string): Promise<AppleServerEvent[]>;
}
