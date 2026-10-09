import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAttemptLimiter, createRequestLimiter, RateLimitError } from '../rateLimiter';

const clock = (start = 1_000_000) => {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
};

describe('createAttemptLimiter', () => {
  beforeEach(() => AsyncStorage.clear());

  it('locks a key after maxFailures and unlocks after the lockout', async () => {
    const c = clock();
    const limiter = createAttemptLimiter({ name: 't1', maxFailures: 5, windowMs: 60_000, lockoutMs: 30_000, now: c.now });

    for (let i = 0; i < 4; i++) {
      expect((await limiter.recordFailure('a@x.com')).lockedNow).toBe(false);
    }
    expect((await limiter.check('a@x.com')).allowed).toBe(true);

    const fifth = await limiter.recordFailure('a@x.com');
    expect(fifth.lockedNow).toBe(true);
    expect(await limiter.check('a@x.com')).toEqual({ allowed: false, retryAfterMs: 30_000 });
    await expect(limiter.assertAllowed('a@x.com')).rejects.toBeInstanceOf(RateLimitError);

    c.advance(30_001);
    expect((await limiter.check('a@x.com')).allowed).toBe(true);
  });

  it('does not affect other keys and treats keys case-insensitively', async () => {
    const limiter = createAttemptLimiter({ name: 't2', maxFailures: 2, windowMs: 60_000, lockoutMs: 30_000 });
    await limiter.recordFailure('Victim@X.com');
    await limiter.recordFailure(' victim@x.com ');
    expect((await limiter.check('victim@x.com')).allowed).toBe(false);
    expect((await limiter.check('someone-else@x.com')).allowed).toBe(true);
  });

  it('doubles repeated lockouts up to the maximum', async () => {
    const c = clock();
    const limiter = createAttemptLimiter({ name: 't3', maxFailures: 1, windowMs: 60_000, lockoutMs: 10_000, maxLockoutMs: 25_000, now: c.now });
    expect((await limiter.recordFailure('k')).retryAfterMs).toBe(10_000);
    c.advance(10_001);
    expect((await limiter.recordFailure('k')).retryAfterMs).toBe(20_000);
    c.advance(20_001);
    expect((await limiter.recordFailure('k')).retryAfterMs).toBe(25_000);
  });

  it('forgets failures outside the window and on reset', async () => {
    const c = clock();
    const limiter = createAttemptLimiter({ name: 't4', maxFailures: 2, windowMs: 1_000, lockoutMs: 5_000, now: c.now });
    await limiter.recordFailure('k');
    c.advance(1_500);
    expect((await limiter.recordFailure('k')).lockedNow).toBe(false);
    await limiter.reset('k');
    expect((await limiter.recordFailure('k')).lockedNow).toBe(false);
  });

  it('persists lockouts so a fresh limiter instance (app restart) is still locked', async () => {
    const opts = { name: 't5', maxFailures: 1, windowMs: 60_000, lockoutMs: 60_000 };
    await createAttemptLimiter(opts).recordFailure('k');
    expect((await createAttemptLimiter(opts).check('k')).allowed).toBe(false);
  });
});

describe('createRequestLimiter', () => {
  beforeEach(() => AsyncStorage.clear());

  it('allows maxRequests per window then throws a 429 RateLimitError', async () => {
    const c = clock();
    const limiter = createRequestLimiter({ name: 'r1', maxRequests: 3, windowMs: 10_000, now: c.now });
    await limiter.consume('k');
    await limiter.consume('k');
    await limiter.consume('k');
    const error = await limiter.consume('k').catch((e) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.status).toBe(429);
    expect(error.userMessage).toMatch(/wait 10 seconds/);

    c.advance(10_001);
    await expect(limiter.consume('k')).resolves.toBeUndefined();
  });

  it('enforces a minimum interval between requests', async () => {
    const c = clock();
    const limiter = createRequestLimiter({ name: 'r2', maxRequests: 10, windowMs: 60_000, minIntervalMs: 5_000, now: c.now });
    await limiter.consume('k');
    c.advance(1_000);
    await expect(limiter.consume('k')).rejects.toBeInstanceOf(RateLimitError);
    c.advance(4_000);
    await expect(limiter.consume('k')).resolves.toBeUndefined();
  });
});
