/** Reputation-adjusted confidence thresholds for the decision engine. */

export function thresholdsFor(reputation: number): { auto: number; light: number } {
  const clamped = Math.max(-50, Math.min(100, reputation));
  // Base: auto ≥ 0.85, light ≥ 0.55. Reputation ±0.15.
  const boost = Math.max(-0.15, Math.min(0.15, clamped / 200));
  return {
    auto: Math.max(0.7, Math.min(0.95, 0.85 - boost)),
    light: Math.max(0.35, Math.min(0.7, 0.55 - boost)),
  };
}
