import type { Redis } from "ioredis";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

// Atomic INCR + first-hit EXPIRE so a crash between the two can't leave a key
// without a TTL (which would throttle a user forever). Fixed window per key.
const INCR_WITH_EXPIRE =
  "local c = redis.call('INCR', KEYS[1]) if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end return c";

/**
 * Fixed-window per-key rate limiter backed by Redis.
 * Used to throttle sensitive bot flows (wallet linking, quest creation/editing).
 */
export function createRateLimiter(redis: Redis) {
  return async function check(
    key: string,
    limit: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    const count = (await redis.eval(INCR_WITH_EXPIRE, 1, redisKey, String(windowSec))) as number;
    if (count > limit) {
      const ttl = await redis.ttl(redisKey);
      return { allowed: false, retryAfterSec: ttl > 0 ? ttl : windowSec };
    }
    return { allowed: true, retryAfterSec: 0 };
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
