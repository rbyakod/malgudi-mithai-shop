// lib/wallet/impl/NodePassbookWalletService.test.ts
// NodePassbookWalletService unit tests — Task 18.5.
//
// The packaging/signing path is gated behind `node-passbook` + Apple Developer
// certs (not installed/unavailable until plan Open Question #8 activates), so
// these tests cover the pure helpers (buildPassJson, buildManifest — exercised
// unconditionally in generatePass before the gate) and the gating error path.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  buildPassJson,
  buildManifest,
  NodePassbookWalletService,
  type NodePassbookOptions,
} from './NodePassbookWalletService';
import type { WalletPassFields } from '../WalletPassService';

const fields: WalletPassFields = {
  serialNumber: 'mishran-007',
  tier: 'gold',
  holderName: 'Ravi',
  balanceLabel: '320',
};

const baseOpts: Pick<
  NodePassbookOptions,
  'teamIdentifier' | 'passTypeIdentifier' | 'theme'
> = {
  teamIdentifier: 'ABC1234567',
  passTypeIdentifier: 'pass.com.mishran.wallet',
};

describe('buildPassJson', () => {
  it('emits a valid storeCard pass.json with brand defaults', () => {
    const pass = buildPassJson(fields, baseOpts);
    expect(pass.formatVersion).toBe(1);
    expect(pass.passTypeIdentifier).toBe('pass.com.mishran.wallet');
    expect(pass.teamIdentifier).toBe('ABC1234567');
    expect(pass.serialNumber).toBe('mishran-007');
    expect(pass.organizationName).toBe('Mishran');
    // kakvi brown / saffron brand defaults (matches lib/themes.ts canonical).
    expect(pass.backgroundColor).toBe('rgb(155,77,42)');
    expect(pass.foregroundColor).toBe('rgb(255,248,240)');
    expect(pass.labelColor).toBe('rgb(215,154,53)');
  });

  it('surfaces tier, holder + balance as storeCard fields', () => {
    const pass = buildPassJson(fields, baseOpts) as {
      storeCard: {
        primaryFields: Array<{ key: string; value: string }>;
        auxiliaryFields: Array<{ key: string; value: string }>;
      };
    };
    expect(pass.storeCard.primaryFields[0]).toMatchObject({
      key: 'tier',
      value: 'GOLD',
    });
    const aux = Object.fromEntries(
      pass.storeCard.auxiliaryFields.map((f) => [f.key, f.value]),
    );
    expect(aux.holder).toBe('Ravi');
    expect(aux.balance).toBe('320');
  });

  it('falls back to defaults when optional fields are absent', () => {
    const pass = buildPassJson(
      { serialNumber: 'x', tier: 'silver' },
      {},
    ) as Record<string, unknown> & {
      storeCard: { auxiliaryFields: Array<{ key: string; value: string }> };
    };
    expect(pass.teamIdentifier).toBe('TEAMID');
    expect(pass.passTypeIdentifier).toBe('pass.com.mishran.wallet');
    const aux = Object.fromEntries(
      pass.storeCard.auxiliaryFields.map((f) => [f.key, f.value]),
    );
    expect(aux.holder).toBe('Member');
    expect(aux.balance).toBe('0');
  });

  it('honors theme overrides over brand defaults', () => {
    const pass = buildPassJson(fields, {
      ...baseOpts,
      theme: {
        backgroundColor: 'rgb(10,20,30)',
        foregroundColor: 'rgb(255,255,255)',
        labelColor: 'rgb(255,215,0)',
      },
    });
    expect(pass.backgroundColor).toBe('rgb(10,20,30)');
    expect(pass.foregroundColor).toBe('rgb(255,255,255)');
    expect(pass.labelColor).toBe('rgb(255,215,0)');
  });
});

describe('buildManifest', () => {
  it('SHA1-hashes each file content', () => {
    const files = {
      'pass.json': '{"a":1}',
      'icon.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    };
    const manifest = buildManifest(files);
    expect(manifest['pass.json']).toBe(
      createHash('sha1').update('{"a":1}', 'utf8').digest('hex'),
    );
    expect(manifest['icon.png']).toBe(
      createHash('sha1').update(Buffer.from([0x89, 0x50, 0x4e, 0x47])).digest('hex'),
    );
    expect(Object.keys(manifest)).toHaveLength(2);
  });

  it('accepts Buffer content directly', () => {
    const buf = Buffer.from('hello');
    const manifest = buildManifest({ 'logo.png': buf });
    expect(manifest['logo.png']).toBe(createHash('sha1').update(buf).digest('hex'));
  });
});

describe('NodePassbookWalletService.generatePass (gating)', () => {
  const fullOpts: NodePassbookOptions = {
    ...baseOpts,
    passbookCertPath: 'certs/passbook.p12',
    passbookCertPassword: 'pw',
    wwdrCertPath: 'certs/wwdr.pem',
    storageBucket: 'mithai-wallet-passes',
  };

  it('throws a clear gated error when node-passbook is absent', async () => {
    const svc = new NodePassbookWalletService(fullOpts);
    await expect(svc.generatePass(fields)).rejects.toThrow(
      /node-passbook is not installed/,
    );
  });

  it('createSignedPassUrl propagates the gating error', async () => {
    const svc = new NodePassbookWalletService(fullOpts);
    await expect(svc.createSignedPassUrl(fields)).rejects.toThrow(
      /node-passbook is not installed/,
    );
  });
});
