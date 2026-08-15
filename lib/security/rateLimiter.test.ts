import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rateLimiter';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

describe('RateLimiter', () => {
  let limiter: RateLimiter;
  let client: MongoClient;
  let replSet: MongoMemoryReplSet;

  beforeEach(async () => {
    replSet = await MongoMemoryReplSet.create();
    client = new MongoClient(replSet.getUri());
    await client.connect();
    await client.db().dropDatabase();
    limiter = new RateLimiter(client.db());
  });

  afterEach(async () => {
    await client.close();
    if (replSet) await replSet.stop();
  });

  it('allows up to limit then blocks', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(limiter.check('phone:+91', 5, 3600)).resolves.toBeUndefined();
    }
    await expect(limiter.check('phone:+91', 5, 3600)).rejects.toThrow();
  });

  it('separate keys are independent', async () => {
    await limiter.check('phone:A', 2, 3600);
    await limiter.check('phone:A', 2, 3600);
    await expect(limiter.check('phone:B', 2, 3600)).resolves.toBeUndefined();
  });

  it('resets an expired window instead of colliding on _id', async () => {
    // A bucket left over from an earlier window used to make the upsert
    // attempt a second insert with the same _id (E11000 → bare 500).
    type Bucket = { _id: string; count: number; windowStart: Date };
    const buckets = client.db().collection<Bucket>('rateBuckets');
    await buckets.insertOne({
      _id: 'phone:stale',
      count: 5,
      windowStart: new Date(Date.now() - 2 * 3600 * 1000),
    });
    await expect(limiter.check('phone:stale', 5, 3600)).resolves.toBeUndefined();
    const doc = await buckets.findOne({ _id: 'phone:stale' });
    expect(doc?.count).toBe(1);
    expect(doc?.windowStart).toBeInstanceOf(Date);
  });
});
