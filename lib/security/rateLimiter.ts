import type { Db } from 'mongodb';
import { ApiError, ErrorCode } from '../api/errors';

interface RateBucket { _id: string; count: number; windowStart: Date; }

export class RateLimiter {
  constructor(private db: Db) {}

  async check(key: string, limit: number, windowSeconds: number): Promise<void> {
    const col = this.db.collection<RateBucket>('rateBuckets');
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSeconds * 1000);

    // Atomic upsert + increment with an in-pipeline window reset. The filter
    // matches on _id ALONE — deliberately not on windowStart: a stale bucket
    // from an earlier window must reset the counter, not let the upsert try a
    // second insert with the same _id (E11000, which surfaced as a bare 500
    // for every phone returning after an idle window).
    const result = await col.findOneAndUpdate(
      { _id: key },
      [
        {
          $set: {
            count: {
              $cond: [
                { $gte: ['$windowStart', windowStart] },
                { $add: ['$count', 1] },
                1,
              ],
            },
            windowStart: {
              $cond: [
                { $gte: ['$windowStart', windowStart] },
                '$windowStart',
                now,
              ],
            },
          },
        },
      ],
      { upsert: true, returnDocument: 'after' },
    );

    if (result && result.count > limit) {
      throw new ApiError(ErrorCode.RATE_LIMITED, `Rate limit exceeded for ${key}`, { retryable: true });
    }
  }
}
