/** Reputation-adjusted confidence thresholds for the decision engine. */

export interface ReputationContext {
  score: number;
  /** Fraction of decided submissions that were accepted (0–1). */
  acceptanceRate?: number;
  /** Days since account creation. */
  ageDays?: number;
}

/**
 * Blend raw score with acceptance rate and account longevity so trusted
 * contributors get slightly lower auto/light thresholds.
 */
export function effectiveReputation(ctx: ReputationContext | number): number {
  if (typeof ctx === "number") return ctx;
  let r = ctx.score;
  if (ctx.acceptanceRate != null && Number.isFinite(ctx.acceptanceRate)) {
    r += Math.round((ctx.acceptanceRate - 0.5) * 20);
  }
  if (ctx.ageDays != null && Number.isFinite(ctx.ageDays) && ctx.ageDays > 0) {
    r += Math.min(15, Math.floor(ctx.ageDays / 30));
  }
  return r;
}

export function thresholdsFor(reputation: ReputationContext | number): {
  auto: number;
  light: number;
} {
  const clamped = Math.max(-50, Math.min(100, effectiveReputation(reputation)));
  // Base: auto ≥ 0.85, light ≥ 0.55. Reputation ±0.15.
  const boost = Math.max(-0.15, Math.min(0.15, clamped / 200));
  return {
    auto: Math.max(0.7, Math.min(0.95, 0.85 - boost)),
    light: Math.max(0.35, Math.min(0.7, 0.55 - boost)),
  };
}
