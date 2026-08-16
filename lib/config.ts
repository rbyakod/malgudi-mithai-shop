import { z } from 'zod';

const schema = z.object({
  nodeEnv: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  mongoUri: z.string({ message: 'MONGODB_URI is required' }).min(1, 'MONGODB_URI is required'),
  payloadSecret: z
    .string({ message: 'PAYLOAD_SECRET is required' })
    .min(32, 'PAYLOAD_SECRET must be at least 32 chars'),
  jwtPrivateKey: z.string({ message: 'JWT_PRIVATE_KEY is required' }).min(1, 'JWT_PRIVATE_KEY is required'),
  jwtPublicKey: z.string({ message: 'JWT_PUBLIC_KEY is required' }).min(1, 'JWT_PUBLIC_KEY is required'),
  razorpayKeyId: z.string({ message: 'RAZORPAY_KEY_ID is required' }).min(1, 'RAZORPAY_KEY_ID is required'),
  razorpayKeySecret: z.string({ message: 'RAZORPAY_KEY_SECRET is required' }).min(1, 'RAZORPAY_KEY_SECRET is required'),
  razorpayWebhookSecret: z.string({ message: 'RAZORPAY_WEBHOOK_SECRET is required' }).min(1, 'RAZORPAY_WEBHOOK_SECRET is required'),
  msg91AuthKey: z.string({ message: 'MSG91_AUTH_KEY is required' }).min(1, 'MSG91_AUTH_KEY is required'),
  msg91SenderId: z.string({ message: 'MSG91_SENDER_ID is required' }).min(1, 'MSG91_SENDER_ID is required'),
  msg91TemplateOtp: z.string({ message: 'MSG91_TEMPLATE_OTP is required' }).min(1, 'MSG91_TEMPLATE_OTP is required'),
  fcmProjectId: z.string().optional(),
  fcmServiceAccountJson: z.string().optional(),
  msg91TemplateSmsConfirmed: z.string().optional(),
  msg91TemplateSmsDispatched: z.string().optional(),
  msg91TemplateSmsOutForDelivery: z.string().optional(),
  msg91TemplateSmsDelivered: z.string().optional(),
  resendApiKey: z.string({ message: 'RESEND_API_KEY is required' }).min(1, 'RESEND_API_KEY is required'),
  sentryDsn: z.string().optional().default(''),
  storageProvider: z.enum(['local', 'minio', 's3']).default('local'),
  storageLocalPath: z.string().default('./uploads'),
  flagProvider: z.enum(['env', 'growthbook']).default('env'),
  ga4Id: z.string().optional(),
  metaPixelId: z.string().optional(),
  // Sign-in-with-Apple (Task 15.3). Services ID / Client ID used as the JWT
  // audience. Optional — absent in test; container falls back to the fake.
  appleClientId: z.string().optional(),
  // Apple Wallet (Task 18.5). Passbook P12 + WWDR cert paths + object-storage
  // creds for hosting signed .pkpass bundles. All optional — absent in test
  // and in any box without Apple Developer certs; container falls back to the
  // fake. WALLET_PROVIDER=node-passbook is the real adapter.
  passbookCertPath: z.string().optional(),
  passbookCertPassword: z.string().optional(),
  passbookWwdrPath: z.string().optional(),
  appleTeamIdentifier: z.string().optional(),
  applePassTypeIdentifier: z.string().optional(),
  walletPassesBucket: z.string().default('mithai-wallet-passes'),
  // Shared S3/MinIO object-storage connection (self-hosted MinIO first,
  // cloud S3 swap is config-only per the infra-first ADR).
  storageEndpoint: z.string().optional(),
  storageRegion: z.string().optional(),
  storageAccessKey: z.string().optional(),
  storageSecretKey: z.string().optional(),
  // APNs (iOS push + Live Activity — Task 18.4). Token-based auth (.p8 key).
  // Optional — absent in test; container resolves apnsService to FakePushService
  // so a box without APNs creds never attempts an unreachable APNs call.
  apnsTeamId: z.string().optional(),
  apnsKeyId: z.string().optional(),
  apnsPrivateKey: z.string().optional(),
  apnsBundleId: z.string().optional(),
  // Commerce delivery fees (commerce launch, Batch 2). Flat fee by
  // serviceability tier — fresh (same-city) vs shelf-stable (courier).
  // coerce so plain-string env values parse; defaults are the user-decided
  // ₹49 / ₹99.
  deliveryFeeFreshPaise: z.coerce.number().int().min(0).default(4900),
  deliveryFeeShelfStablePaise: z.coerce.number().int().min(0).default(9900),
  // Free-delivery thresholds (conversion batch, Batch A). Subtotal at or
  // above the tier's threshold waives the delivery fee (0 disables the
  // waiver for that tier). Defaults are the user-decided ₹999 fresh /
  // ₹1,999 shelf-stable.
  freeDeliveryThresholdFreshPaise: z.coerce.number().int().min(0).default(99900),
  freeDeliveryThresholdShelfStablePaise: z.coerce.number().int().min(0).default(199900),
});

export type Config = z.infer<typeof schema> & {
  jwt: { algorithm: 'RS256'; accessTtlSeconds: number; refreshTtlSeconds: number };
  otp: {
    length: number;
    ttlSeconds: number;
    rateLimit: { perPhonePerHour: number; perPhonePerDay: number };
  };
};

// Map UPPER_SNAKE_CASE process.env to the camelCase keys the zod schema expects.
const env = {
  nodeEnv: process.env.NODE_ENV,
  mongoUri: process.env.MONGODB_URI,
  payloadSecret: process.env.PAYLOAD_SECRET,
  jwtPrivateKey: process.env.JWT_PRIVATE_KEY,
  jwtPublicKey: process.env.JWT_PUBLIC_KEY,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  msg91AuthKey: process.env.MSG91_AUTH_KEY,
  msg91SenderId: process.env.MSG91_SENDER_ID,
  msg91TemplateOtp: process.env.MSG91_TEMPLATE_OTP,
  fcmProjectId: process.env.FCM_PROJECT_ID,
  fcmServiceAccountJson: process.env.FCM_SERVICE_ACCOUNT_JSON,
  msg91TemplateSmsConfirmed: process.env.MSG91_TEMPLATE_SMS_CONFIRMED,
  msg91TemplateSmsDispatched: process.env.MSG91_TEMPLATE_SMS_DISPATCHED,
  msg91TemplateSmsOutForDelivery: process.env.MSG91_TEMPLATE_SMS_OUT_FOR_DELIVERY,
  msg91TemplateSmsDelivered: process.env.MSG91_TEMPLATE_SMS_DELIVERED,
  resendApiKey: process.env.RESEND_API_KEY,
  sentryDsn: process.env.SENTRY_DSN,
  storageProvider: process.env.STORAGE_PROVIDER,
  storageLocalPath: process.env.STORAGE_LOCAL_PATH,
  flagProvider: process.env.FLAG_PROVIDER,
  ga4Id: process.env.GA4_ID,
  metaPixelId: process.env.META_PIXEL_ID,
  appleClientId: process.env.APPLE_CLIENT_ID,
  passbookCertPath: process.env.PASSBOOK_CERT_PATH,
  passbookCertPassword: process.env.PASSBOOK_CERT_PASSWORD,
  passbookWwdrPath: process.env.PASSBOOK_WWDR_PATH,
  appleTeamIdentifier: process.env.APPLE_TEAM_ID,
  applePassTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
  walletPassesBucket: process.env.WALLET_PASSES_BUCKET,
  storageEndpoint: process.env.STORAGE_ENDPOINT,
  storageRegion: process.env.STORAGE_REGION,
  storageAccessKey: process.env.STORAGE_ACCESS_KEY,
  storageSecretKey: process.env.STORAGE_SECRET_KEY,
  apnsTeamId: process.env.APNS_TEAM_ID,
  apnsKeyId: process.env.APNS_KEY_ID,
  apnsPrivateKey: process.env.APNS_PRIVATE_KEY,
  apnsBundleId: process.env.APNS_BUNDLE_ID,
  deliveryFeeFreshPaise: process.env.DELIVERY_FEE_FRESH_PAISE,
  deliveryFeeShelfStablePaise: process.env.DELIVERY_FEE_SHELF_STABLE_PAISE,
  freeDeliveryThresholdFreshPaise: process.env.FREE_DELIVERY_THRESHOLD_FRESH_PAISE,
  freeDeliveryThresholdShelfStablePaise:
    process.env.FREE_DELIVERY_THRESHOLD_SHELF_STABLE_PAISE,
};

export const config: Config = {
  ...schema.parse(env),
  jwt: {
    algorithm: 'RS256',
    accessTtlSeconds: 15 * 60,
    refreshTtlSeconds: 30 * 24 * 60 * 60,
  },
  otp: {
    length: 6,
    ttlSeconds: 5 * 60,
    rateLimit: { perPhonePerHour: 5, perPhonePerDay: 10 },
  },
};
