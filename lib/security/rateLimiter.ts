import type { Db } from 'mongodb';
import { ApiError, ErrorCode } from '../api/errors';

interface RateBucket { _id: string; count: number; windowStart: Date; }

export class RateLimiter {
  constructor(private db: Db) {}

  async check(key: string, limit: number, windowSeconds: number): Promise<void> {
    const col = this.db.collection<RateBucket>('rateBuckets');
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSeconds * 1000);

    // Atomic upsert + increment
    const result = await col.findOneAndUpdate(
      { _id: key, windowStart: { $gte: windowStart } },
      { $inc: { count: 1 }, $setOnInsert: { windowStart: now } },
      { upsert: true, returnDocument: 'after' },
    );

    if (result && result.count > limit) {
      throw new ApiError(ErrorCode.RATE_LIMITED, `Rate limit exceeded for ${key}`, { retryable: true });
    }
  }
}
