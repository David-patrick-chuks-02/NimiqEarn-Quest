import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison. Returns false for length mismatches or
 * non-string input without leaking timing information about the expected value.
 */
export function safeCompare(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
