import type { Redis } from "ioredis";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/**
 * Fixed-window per-key rate limiter backed by Redis (INCR + EXPIRE).
 * Used to throttle sensitive bot flows (wallet linking, quest creation/editing).
 */
export function createRateLimiter(redis: Redis) {
  return async function check(
    key: string,
    limit: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSec);
    }
    if (count > limit) {
      const ttl = await redis.ttl(redisKey);
      return { allowed: false, retryAfterSec: ttl > 0 ? ttl : windowSec };
    }
    return { allowed: true, retryAfterSec: 0 };
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
