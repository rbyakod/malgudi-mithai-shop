import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWTPayload } from 'jose';
import { randomUUID, createPrivateKey, createPublicKey } from 'node:crypto';
import { getPayload } from 'payload';
import config from '../../payload.config';

export interface TokenClaims extends JWTPayload {
  customerId: string;
  kind: 'access' | 'refresh';
}

export class JwtService {
  constructor(
    private deps: {
      privateKey: string;
      publicKey: string;
      accessTtlSeconds: number;
      refreshTtlSeconds: number;
      isRevoked?: (jti: string, customerId: string) => Promise<boolean>;
    },
  ) {}

  private async key(kind: 'private' | 'public') {
    // Normalize PEM to PKCS#8 (private) / SPKI (public) via Node crypto,
    // which accepts both PKCS#1 and PKCS#8 inputs. jose v6 requires a string.
    const normalized =
      kind === 'private'
        ? (createPrivateKey(this.deps.privateKey).export({ type: 'pkcs8', format: 'pem' }) as string)
        : (createPublicKey(this.deps.publicKey).export({ type: 'spki', format: 'pem' }) as string);
    return kind === 'private' ? importPKCS8(normalized, 'RS256') : importSPKI(normalized, 'RS256');
  }

  async issueAccessToken(customerId: string): Promise<string> {
    const key = await this.key('private');
    return new SignJWT({ customerId, kind: 'access' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${this.deps.accessTtlSeconds}s`)
      .sign(key);
  }

  async issueRefreshToken(customerId: string): Promise<string> {
    const key = await this.key('private');
    return new SignJWT({ customerId, kind: 'refresh' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${this.deps.refreshTtlSeconds}s`)
      .sign(key);
  }

  async verify(token: string, expectedKind?: 'access' | 'refresh'): Promise<TokenClaims> {
    const key = await this.key('public');
    const { payload: verified } = await jwtVerify(token, key, { algorithms: ['RS256'] });
    const claims = verified as TokenClaims;
    if (expectedKind && claims.kind !== expectedKind) {
      throw new Error(`Expected ${expectedKind} token, got ${claims.kind}`);
    }
    // Check revocation list (injectable; skipped if no callback provided).
    // customerId rides along so the container can honor per-customer
    // force-logout sentinels (Task 20.5 Apple revocation).
    if (this.deps.isRevoked && claims.jti) {
      if (await this.deps.isRevoked(claims.jti, claims.customerId)) {
        throw new Error('Token revoked');
      }
    }
    return claims;
  }

  async revoke(
    jti: string,
    customerId: string,
    reason: 'logout' | 'rotation' | 'revoked' | 'biometric_reset',
    expiresAt: Date,
  ): Promise<void> {
    const payloadSDK = await getPayload({ config });
    await payloadSDK.create({
      collection: 'revokedTokens',
      data: { jti, customerId, reason, expiresAt: expiresAt.toISOString() },
    });
  }
}
