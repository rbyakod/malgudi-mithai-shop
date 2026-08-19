// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { JwtService } from './JwtService';
import { generateKeyPairSync } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

describe('JwtService', () => {
  let svc: JwtService;
  beforeAll(() => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = (k: KeyObject) => k.export({ type: 'pkcs1', format: 'pem' }).toString();
    svc = new JwtService({ privateKey: pem(privateKey), publicKey: pem(publicKey), accessTtlSeconds: 60, refreshTtlSeconds: 3600 });
  });

  it('issues and verifies access token', async () => {
    const tok = await svc.issueAccessToken('cust_1');
    const claims = await svc.verify(tok);
    expect(claims.customerId).toBe('cust_1');
    expect(claims.kind).toBe('access');
  });

  it('issues and verifies refresh token', async () => {
    const tok = await svc.issueRefreshToken('cust_1');
    const claims = await svc.verify(tok);
    expect(claims.kind).toBe('refresh');
  });

  it('rejects wrong kind', async () => {
    const refresh = await svc.issueRefreshToken('cust_1');
    await expect(svc.verify(refresh, 'access')).rejects.toThrow();
  });

  it('rejects tampered token', async () => {
    const tok = await svc.issueAccessToken('cust_1');
    await expect(svc.verify(tok + 'x')).rejects.toThrow();
  });
});
