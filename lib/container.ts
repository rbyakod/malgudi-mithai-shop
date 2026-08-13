// DI container — Task 2.9 (scoped).
//
// Wires the services that exist today: jwtService, otpService,
// paymentService, rateLimiter, logger. Other services (push, sms, email,
// analytics, storage, search, feature flags, error reporter) land in
// later tasks (5.2, …) and will be appended here as their impl files are
// introduced.
//
// API contract preserved for callers in app/api/mobile/v1/auth/**:
//   - container.jwtService           — sync instance (JwtService)
//   - container.otpService           — sync instance (OtpService impl)
//   - container.paymentService       — sync instance (PaymentService impl)
//   - container.rateLimiter.check()  — async method on sync facade object
//   - container.logger               — sync Pino logger
//
// The rateLimiter facade defers Mongo connection until first use; the
// surface stays `await container.rateLimiter.check(...)` so no route code
// changes when the Mongo-backed impl lands.

import { MongoClient, type Db } from 'mongodb';
import { JwtService } from './auth/JwtService';
import { Msg91OtpService } from './auth/impl/Msg91OtpService';
import { FakeOtpService } from './auth/impl/FakeOtpService';
import type { OtpService } from './auth/OtpService';
import { RazorpayPaymentService } from './commerce/impl/RazorpayPaymentService';
import { FakePaymentService } from './commerce/impl/FakePaymentService';
import type { PaymentService } from './commerce/PaymentService';
import type { RateLimiter } from './security/rateLimiter';
import { logger } from './observability/Logger';
import { config } from './config';

// ---------------------------------------------------------------------------
// JwtService
// ---------------------------------------------------------------------------
//
// `isRevoked` callback is wired to a Payload `revokedTokens` lookup. The
// callback holds a lazy Payload singleton so we do not force Payload init at
// module load — important for unit tests that mock the container wholesale.
// The inline getPayload() inside JwtService.revoke() remains; see Task 2.3
// deferred-decisions register. TODO: when a second consumer needs the
// revokedTokens collection, lift this into a shared RevokedTokenRepo.

let payloadSingleton: Promise<PayloadLike> | null = null;
async function getPayloadSingleton(): Promise<PayloadLike> {
  if (!payloadSingleton) {
    const { getPayload } = await import('payload');
    const payloadConfig = (await import('../payload.config')).default;
    payloadSingleton = getPayload({ config: payloadConfig }) as Promise<PayloadLike>;
  }
  return payloadSingleton;
}

interface PayloadLike {
  find(args: {
    collection: string;
    where: Record<string, unknown>;
    limit?: number;
  }): Promise<{ docs: Array<{ id: string | number }> }>;
}

const jwtService = new JwtService({
  privateKey: config.jwtPrivateKey,
  publicKey: config.jwtPublicKey,
  accessTtlSeconds: config.jwt.accessTtlSeconds,
  refreshTtlSeconds: config.jwt.refreshTtlSeconds,
  isRevoked: async (jti: string): Promise<boolean> => {
    const payload = await getPayloadSingleton();
    const found = await payload.find({
      collection: 'revokedTokens',
      where: { jti: { equals: jti } },
      limit: 1,
    });
    return found.docs.length > 0;
  },
});

// ---------------------------------------------------------------------------
// OtpService — env-driven, resolved sync at module load
// ---------------------------------------------------------------------------

function resolveOtp(): OtpService {
  const provider = process.env.OTP_PROVIDER ?? (config.nodeEnv === 'test' ? 'fake' : 'msg91');
  if (provider === 'fake') return new FakeOtpService();
  if (provider === 'msg91') {
    return new Msg91OtpService({
      authKey: config.msg91AuthKey,
      senderId: config.msg91SenderId,
      templateId: config.msg91TemplateOtp,
    });
  }
  throw new Error(`Unknown OTP_PROVIDER "${provider}"`);
}

const otpService: OtpService = resolveOtp();

// ---------------------------------------------------------------------------
// PaymentService — env-driven, resolved sync at module load
// ---------------------------------------------------------------------------
//
// Mirrors the OTP pattern: PAYMENT_PROVIDER=fake (or NODE_ENV=test) selects
// the in-memory fake; otherwise RazorpayPaymentService is wired with the
// shared config. Vendor swap is config + impl change (adapter ADR).

function resolvePayment(): PaymentService {
  const provider =
    process.env.PAYMENT_PROVIDER ?? (config.nodeEnv === 'test' ? 'fake' : 'razorpay');
  if (provider === 'fake') return new FakePaymentService();
  if (provider === 'razorpay') {
    return new RazorpayPaymentService({
      keyId: config.razorpayKeyId,
      keySecret: config.razorpayKeySecret,
    });
  }
  throw new Error(`Unknown PAYMENT_PROVIDER "${provider}"`);
}

const paymentService: PaymentService = resolvePayment();

// ---------------------------------------------------------------------------
// RateLimiter — async-init behind a sync facade
// ---------------------------------------------------------------------------
//
// Mongo `Db` handle is acquired via a shared MongoClient connected on first
// use. A direct MongoClient is used (rather than `payload.db`) so the
// container does not depend on Payload init order. The facade preserves the
// sync `container.rateLimiter.check(...)` call site.

let mongoClient: MongoClient | null = null;
let rateLimiterInstance: RateLimiter | null = null;
let rateLimiterPromise: Promise<RateLimiter> | null = null;

async function getRateLimiter(): Promise<RateLimiter> {
  if (rateLimiterInstance) return rateLimiterInstance;
  if (!rateLimiterPromise) {
    rateLimiterPromise = (async () => {
      const { RateLimiter } = await import('./security/rateLimiter');
      if (!mongoClient) {
        mongoClient = new MongoClient(config.mongoUri);
        await mongoClient.connect();
      }
      const db: Db = mongoClient.db();
      rateLimiterInstance = new RateLimiter(db);
      return rateLimiterInstance;
    })();
  }
  return rateLimiterPromise;
}

const rateLimiterFacade = {
  async check(key: string, limit: number, windowSeconds: number): Promise<void> {
    const limiter = await getRateLimiter();
    return limiter.check(key, limit, windowSeconds);
  },
};

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

export const container = {
  jwtService,
  otpService,
  paymentService,
  rateLimiter: rateLimiterFacade,
  logger,
  // TODO(Task 5.2): pushService — FcmPushService / FakePushService
  // TODO(Task 5.2): smsService — Msg91SmsService / fake
  // TODO(later): emailService — ResendEmailService
  // TODO(later): analyticsService — MultiAnalyticsService
  // TODO(later): storageService — LocalDiskStorageService
  // TODO(later): searchService — MongoSearchService
  // TODO(later): flagService — EnvFlagService
  // TODO(later): errorReporter — SentryReporter / FakeErrorReporter
};
