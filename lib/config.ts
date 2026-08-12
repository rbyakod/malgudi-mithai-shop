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
  resendApiKey: z.string({ message: 'RESEND_API_KEY is required' }).min(1, 'RESEND_API_KEY is required'),
  sentryDsn: z.string().optional().default(''),
  storageProvider: z.enum(['local', 'minio', 's3']).default('local'),
  storageLocalPath: z.string().default('./uploads'),
  flagProvider: z.enum(['env', 'growthbook']).default('env'),
  ga4Id: z.string().optional(),
  metaPixelId: z.string().optional(),
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
  resendApiKey: process.env.RESEND_API_KEY,
  sentryDsn: process.env.SENTRY_DSN,
  storageProvider: process.env.STORAGE_PROVIDER,
  storageLocalPath: process.env.STORAGE_LOCAL_PATH,
  flagProvider: process.env.FLAG_PROVIDER,
  ga4Id: process.env.GA4_ID,
  metaPixelId: process.env.META_PIXEL_ID,
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
