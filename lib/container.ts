// DI container — Task 2.9 (scoped).
//
// Wires the services that exist today: jwtService, otpService,
// paymentService, rateLimiter, logger, pushService, smsService. Other
// services (email, analytics, storage, search, feature flags, error
// reporter) land in later tasks and will be appended here as their impl
// files are introduced.
//
// API contract preserved for callers in app/api/mobile/v1/auth/**:
//   - container.jwtService           — sync instance (JwtService)
//   - container.otpService           — sync instance (OtpService impl)
//   - container.paymentService       — sync instance (PaymentService impl)
//   - container.rateLimiter.check()  — async method on sync facade object
//   - container.logger               — sync Pino logger
//   - container.pushService          — sync instance (PushService impl)   [Task 5.2]
//   - container.smsService           — sync instance (SmsService impl)    [Task 5.2]
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
import { FcmPushService } from './notifications/impl/FcmPushService';
import { FakePushService } from './notifications/impl/FakePushService';
import type { PushService } from './notifications/PushService';
import { Msg91SmsService } from './notifications/impl/Msg91SmsService';
import { FakeSmsService } from './notifications/impl/FakeSmsService';
import type { SmsService } from './notifications/SmsService';
import type { AppleAuthService } from './auth/AppleAuthService';
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
// PushService — env-driven, resolved sync at module load
// ---------------------------------------------------------------------------
//
// Mirrors the OTP/payment pattern: PUSH_PROVIDER=fake (or NODE_ENV=test)
// selects the in-memory fake; otherwise FcmPushService is wired with the
// shared config. FCM is only initialized when the provider resolves to
// 'fcm' — important so tests that import container never initialize a real
// Firebase app.

function resolvePush(): PushService {
  const provider = process.env.PUSH_PROVIDER ?? (config.nodeEnv === 'test' ? 'fake' : 'fcm');
  if (provider === 'fake') return new FakePushService();
  if (provider === 'fcm') {
    if (!config.fcmProjectId) {
      // Without a project id FCM init would throw at send time anyway; fall
      // back to fake so a misconfigured prod box still serves orders.
      logger.warn(
        { fcmProjectId: config.fcmProjectId },
        'FCM_PROJECT_ID missing — push falling back to FakePushService',
      );
      return new FakePushService();
    }
    return new FcmPushService({
      projectId: config.fcmProjectId,
      serviceAccountJson: config.fcmServiceAccountJson,
    });
  }
  throw new Error(`Unknown PUSH_PROVIDER "${provider}"`);
}

const pushService: PushService = resolvePush();

// ---------------------------------------------------------------------------
// SmsService — env-driven, resolved sync at module load
// ---------------------------------------------------------------------------
//
// Template IDs are collected from the per-stage MSG91_TEMPLATE_SMS_<STAGE>
// env vars. Stages without a template ID are simply absent from the map;
// Msg91SmsService.send throws on a missing template, and OrderEventEmitter
// logs + skips SMS for that stage. The shipped SMS-enabled stages are
// confirmed/dispatched/out_for_delivery/delivered.

function resolveSms(): SmsService {
  const provider = process.env.SMS_PROVIDER ?? (config.nodeEnv === 'test' ? 'fake' : 'msg91');
  if (provider === 'fake') return new FakeSmsService();
  if (provider === 'msg91') {
    const templateIds: Record<string, string> = {};
    if (config.msg91TemplateSmsConfirmed) {
      templateIds['push.order.confirmed.body'] = config.msg91TemplateSmsConfirmed;
    }
    if (config.msg91TemplateSmsDispatched) {
      templateIds['push.order.dispatched.body'] = config.msg91TemplateSmsDispatched;
    }
    if (config.msg91TemplateSmsOutForDelivery) {
      templateIds['push.order.out_for_delivery.body'] = config.msg91TemplateSmsOutForDelivery;
    }
    if (config.msg91TemplateSmsDelivered) {
      templateIds['push.order.delivered.body'] = config.msg91TemplateSmsDelivered;
    }
    return new Msg91SmsService({
      authKey: config.msg91AuthKey,
      senderId: config.msg91SenderId,
      templateIds,
    });
  }
  throw new Error(`Unknown SMS_PROVIDER "${provider}"`);
}

const smsService: SmsService = resolveSms();

// ---------------------------------------------------------------------------
// AppleAuthService — env-driven, resolved sync at module load (Task 15.3)
// ---------------------------------------------------------------------------
//
// APPLE_AUTH_PROVIDER=apple selects the real JWKS verifier (lazy jose import
// so container import in tests never pays the jose cost); otherwise the fake.
// Also falls back to fake when APPLE_CLIENT_ID is unset — the real verifier
// needs it as the JWT audience, so without it every token would 401.

function resolveAppleAuth(): AppleAuthService {
  const provider = process.env.APPLE_AUTH_PROVIDER ?? (config.nodeEnv === 'test' ? 'fake' : 'apple');
  if (provider === 'fake') {
    const { FakeAppleAuthService } = require('./auth/impl/FakeAppleAuthService');
    return new FakeAppleAuthService() as AppleAuthService;
  }
  if (provider === 'apple') {
    if (!config.appleClientId) {
      logger.warn('APPLE_CLIENT_ID missing — apple auth falling back to fake');
      const { FakeAppleAuthService } = require('./auth/impl/FakeAppleAuthService');
      return new FakeAppleAuthService() as AppleAuthService;
    }
    const { AppleJwksService } = require('./auth/impl/AppleJwksService');
    return new AppleJwksService({ clientId: config.appleClientId }) as AppleAuthService;
  }
  throw new Error(`Unknown APPLE_AUTH_PROVIDER "${provider}"`);
}

const appleAuthService: AppleAuthService = resolveAppleAuth();

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
  pushService,
  smsService,
  appleAuthService,
  // TODO(later): emailService — ResendEmailService
  // TODO(later): analyticsService — MultiAnalyticsService
  // TODO(later): storageService — LocalDiskStorageService
  // TODO(later): searchService — MongoSearchService
  // TODO(later): flagService — EnvFlagService
  // TODO(later): errorReporter — SentryReporter / FakeErrorReporter
};
