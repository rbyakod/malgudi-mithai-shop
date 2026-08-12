import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    vi.resetModules();
    const env: NodeJS.ProcessEnv = {
      MONGODB_URI: 'mongodb://localhost/db',
      PAYLOAD_SECRET: 'a'.repeat(32),
      JWT_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\nTEST\n-----END RSA PRIVATE KEY-----',
      JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----',
      RAZORPAY_KEY_ID: 'rzp_test_xxx',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: 'whsecret',
      MSG91_AUTH_KEY: 'msgkey',
      MSG91_SENDER_ID: 'MISHRN',
      FCM_PROJECT_ID: 'mishran-test',
      SENTRY_DSN: '',
      NODE_ENV: 'test',
    };
    Object.assign(process.env, env);
  });

  it('parses valid env', async () => {
    const { config } = await import('./config');
    expect(config.mongoUri).toBe('mongodb://localhost/db');
    expect(config.jwt.algorithm).toBe('RS256');
    expect(config.otp.rateLimit.perPhonePerHour).toBe(5);
  });

  it('throws on missing required env', async () => {
    delete process.env.MONGODB_URI;
    await expect(() => import('./config')).rejects.toThrow(/MONGODB_URI/);
  });
});
