/** Simple fixed-window in-memory rate limiter (single API instance). */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Best-effort mutual exclusion for short critical sections (e.g. faucet). */
const locks = new Set<string>();

export function tryLock(key: string): boolean {
  if (locks.has(key)) return false;
  locks.add(key);
  return true;
}

export function unlock(key: string): void {
  locks.delete(key);
}
