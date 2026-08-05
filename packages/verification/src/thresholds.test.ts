import { describe, expect, it } from "vitest";
import { effectiveReputation, thresholdsFor } from "./thresholds.js";

describe("thresholdsFor", () => {
  it("uses baseline bands at reputation 0", () => {
    const t = thresholdsFor(0);
    expect(t.auto).toBeCloseTo(0.85, 5);
    expect(t.light).toBeCloseTo(0.55, 5);
  });

  it("lowers auto threshold for trusted users", () => {
    const trusted = thresholdsFor(80);
    const newbie = thresholdsFor(0);
    expect(trusted.auto).toBeLessThan(newbie.auto);
  });

  it("clamps extreme reputation", () => {
    expect(thresholdsFor(10_000).auto).toBeGreaterThanOrEqual(0.7);
    expect(thresholdsFor(-10_000).auto).toBeLessThanOrEqual(0.95);
  });

  it("acceptance rate and longevity boost effective reputation", () => {
    const plain = effectiveReputation(10);
    const rich = effectiveReputation({
      score: 10,
      acceptanceRate: 0.9,
      ageDays: 120,
    });
    expect(rich).toBeGreaterThan(plain);
  });
});
