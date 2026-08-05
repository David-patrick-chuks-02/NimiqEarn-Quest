import type { AiVerifyResponse, VerificationOutcome } from "@nimiqearn/shared";
import type { RuleResult } from "./rule-engine.js";
import { thresholdsFor } from "./thresholds.js";

export interface DecisionInput {
  ruleResult: RuleResult;
  /** Null when verifier is unavailable — fail closed to MANUAL_REVIEW after rules pass. */
  aiResult: AiVerifyResponse | null;
  reputationScore: number;
}

export interface DecisionResult {
  outcome: VerificationOutcome;
  confidence: number;
  reasons: string[];
}

/**
 * Layer 2+ decision: convert rule + AI signals into architecture outcomes.
 */
export function decide(input: DecisionInput): DecisionResult {
  const reasons: string[] = [];

  if (!input.ruleResult.passed || input.ruleResult.hardFail) {
    const failed = input.ruleResult.checks.filter((c) => !c.passed).map((c) => c.code);
    reasons.push(`Rule failure: ${failed.join(", ") || "unknown"}`);
    return { outcome: "REJECT", confidence: 0, reasons };
  }

  if (!input.aiResult) {
    reasons.push("AI verifier unavailable — fail closed to manual review.");
    return { outcome: "MANUAL_REVIEW", confidence: 0.4, reasons };
  }

  const { confidence, recommendation, signals } = input.aiResult;
  const { auto, light } = thresholdsFor(input.reputationScore);
  reasons.push(`AI confidence=${confidence.toFixed(2)} recommendation=${recommendation}`);
  reasons.push(`Thresholds auto≥${auto.toFixed(2)} light≥${light.toFixed(2)} (rep=${input.reputationScore})`);

  if (recommendation === "reject" || confidence < 0.25) {
    reasons.push("AI recommended reject or confidence critically low.");
    return { outcome: "REJECT", confidence, reasons };
  }

  const dup = Number((signals as Record<string, unknown>).duplicateProbability ?? 0);
  if (Number.isFinite(dup) && dup >= 0.85) {
    reasons.push("High duplicate probability — manual review.");
    return { outcome: "MANUAL_REVIEW", confidence, reasons };
  }

  if (recommendation === "approve" && confidence >= auto) {
    reasons.push("High confidence auto-approve.");
    return { outcome: "AUTO_APPROVE", confidence, reasons };
  }

  if (confidence >= light || recommendation === "review") {
    reasons.push("Medium confidence — light review.");
    return { outcome: "LIGHT_REVIEW", confidence, reasons };
  }

  reasons.push("Low confidence — manual moderation.");
  return { outcome: "MANUAL_REVIEW", confidence, reasons };
}
