import { describe, expect, it } from "vitest";
import { softCheck, hardCheck, appendRuleChecks, runRuleEngine } from "./rule-engine.js";
import { decide } from "./decision-engine.js";

describe("soft rule failures", () => {
  it("soft fails do not hardFail the rule result", () => {
    const base = runRuleEngine({ proofType: "TEXT", proof: "hello world feedback" });
    const merged = appendRuleChecks(base, [
      softCheck("behavior_burst", false, "elevated rate"),
    ]);
    expect(merged.passed).toBe(true);
    expect(merged.hardFail).toBe(false);
  });

  it("hard fails still reject", () => {
    const base = runRuleEngine({ proofType: "TEXT", proof: "hello world feedback" });
    const merged = appendRuleChecks(base, [
      hardCheck("tx_found", false, "missing"),
    ]);
    expect(merged.passed).toBe(false);
    expect(merged.hardFail).toBe(true);
  });

  it("soft fails block AUTO_APPROVE", () => {
    const base = runRuleEngine({ proofType: "TEXT", proof: "hello world feedback" });
    const merged = appendRuleChecks(base, [
      softCheck("link_reachable", false, "timeout"),
    ]);
    const d = decide({
      ruleResult: merged,
      aiResult: { confidence: 0.95, signals: {}, recommendation: "approve" },
      reputationScore: 20,
    });
    expect(d.outcome).toBe("LIGHT_REVIEW");
  });

  it("high behavioral risk forces MANUAL_REVIEW", () => {
    const base = runRuleEngine({ proofType: "TEXT", proof: "hello world feedback" });
    const d = decide({
      ruleResult: base,
      aiResult: { confidence: 0.95, signals: {}, recommendation: "approve" },
      reputationScore: 20,
      behavioralRisk: 0.8,
    });
    expect(d.outcome).toBe("MANUAL_REVIEW");
  });
});
