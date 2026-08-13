// lib/wallet/impl/FakeWalletService.test.ts
// FakeWalletService unit tests — Task 18.5.
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeWalletService } from './FakeWalletService';
import type { WalletPassFields } from '../WalletPassService';

const fields: WalletPassFields = {
  serialNumber: 'mishran-001',
  tier: 'gold',
  holderName: 'Ravi',
  balanceLabel: '320',
};

describe('FakeWalletService', () => {
  let svc: FakeWalletService;

  beforeEach(() => {
    svc = new FakeWalletService();
  });

  it('generatePass echoes serialNumber + encodes it in the placeholder buffer', async () => {
    const pass = await svc.generatePass(fields);
    expect(pass.serialNumber).toBe('mishran-001');
    expect(pass.passBuffer.toString('utf8')).toBe('FAKE-PKPASS:mishran-001:gold');
  });

  it('generatePass captures lastGenerated for downstream assertions', async () => {
    await svc.generatePass(fields);
    expect(svc.lastGenerated).toEqual(fields);
  });

  it('uploadPass returns a deterministic fake signed URL', async () => {
    const pass = await svc.generatePass(fields);
    const stored = await svc.uploadPass(pass);
    expect(stored.serialNumber).toBe('mishran-001');
    expect(stored.url).toBe(
      'https://fake-cdn.example.com/wallet/mishran-001.pkpass?token=fake',
    );
  });

  it('createSignedPassUrl composes generate + upload', async () => {
    const stored = await svc.createSignedPassUrl(fields);
    expect(stored.serialNumber).toBe('mishran-001');
    expect(stored.url).toContain('mishran-001.pkpass');
  });

  it('handles silver tier + optional fields omitted', async () => {
    const pass = await svc.generatePass({ serialNumber: 's-1', tier: 'silver' });
    expect(pass.passBuffer.toString('utf8')).toBe('FAKE-PKPASS:s-1:silver');
  });
});
