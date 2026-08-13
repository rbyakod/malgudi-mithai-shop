// Minimal DI container stub — Task 2.6.
// Task 2.9 will replace this with full DI wiring (Mongo-backed RateLimiter,
// real JwtService instance, etc.). For now this lets auth routes compile and
// allows tests to mock the container via vi.mock.
import { FakeOtpService } from './auth/impl/FakeOtpService';
import { logger } from './observability/Logger';

interface RateLimiterLike {
  check(key: string, limit: number, windowSeconds: number): Promise<void>;
}

interface JwtServiceLike {
  issueAccessToken(customerId: string): Promise<string>;
  issueRefreshToken(customerId: string): Promise<string>;
}

export const container: {
  otpService: FakeOtpService;
  rateLimiter: RateLimiterLike;
  jwtService: JwtServiceLike;
  logger: typeof logger;
} = {
  otpService: new FakeOtpService(),
  // No-op rate limiter until Task 2.9 wires the Mongo-backed implementation.
  rateLimiter: { check: async () => undefined },
  // Set by Task 2.9 once JwtService deps (keys, ttls) are configured.
  jwtService: undefined as unknown as JwtServiceLike,
  logger,
};
