import { describe, expect, it } from "vitest";
import { decide } from "./decision-engine.js";
import type { RuleResult } from "./rule-engine.js";

const passRules: RuleResult = {
  passed: true,
  hardFail: false,
  checks: [{ code: "ok", passed: true, message: "ok" }],
};

const failRules: RuleResult = {
  passed: false,
  hardFail: true,
  checks: [{ code: "non_empty", passed: false, message: "empty" }],
};

describe("decide", () => {
  it("rejects on rule failure", () => {
    const d = decide({ ruleResult: failRules, aiResult: null, reputationScore: 50 });
    expect(d.outcome).toBe("REJECT");
  });

  it("fail-closes to MANUAL_REVIEW when AI is unavailable", () => {
    const d = decide({ ruleResult: passRules, aiResult: null, reputationScore: 0 });
    expect(d.outcome).toBe("MANUAL_REVIEW");
  });

  it("auto-approves high confidence approve", () => {
    const d = decide({
      ruleResult: passRules,
      aiResult: { confidence: 0.92, signals: {}, recommendation: "approve" },
      reputationScore: 20,
    });
    expect(d.outcome).toBe("AUTO_APPROVE");
  });

  it("light-reviews medium confidence", () => {
    const d = decide({
      ruleResult: passRules,
      aiResult: { confidence: 0.65, signals: {}, recommendation: "review" },
      reputationScore: 0,
    });
    expect(d.outcome).toBe("LIGHT_REVIEW");
  });

  it("manual-reviews high duplicate probability", () => {
    const d = decide({
      ruleResult: passRules,
      aiResult: {
        confidence: 0.9,
        signals: { duplicateProbability: 0.95 },
        recommendation: "approve",
      },
      reputationScore: 50,
    });
    expect(d.outcome).toBe("MANUAL_REVIEW");
  });

  it("rejects low AI recommendation", () => {
    const d = decide({
      ruleResult: passRules,
      aiResult: { confidence: 0.1, signals: {}, recommendation: "reject" },
      reputationScore: 0,
    });
    expect(d.outcome).toBe("REJECT");
  });

  it("trusted reputation lowers auto threshold", () => {
    const d = decide({
      ruleResult: passRules,
      aiResult: { confidence: 0.78, signals: {}, recommendation: "approve" },
      reputationScore: 80,
    });
    expect(d.outcome).toBe("AUTO_APPROVE");
  });
});
