import type { AiVerifyResponse, VerificationOutcome } from "@nimiqearn/shared";
import type { RuleResult } from "./rule-engine.js";
import { effectiveReputation, thresholdsFor, type ReputationContext } from "./thresholds.js";

export interface DecisionInput {
  ruleResult: RuleResult;
  /** Null when verifier is unavailable — fail closed to MANUAL_REVIEW after rules pass. */
  aiResult: AiVerifyResponse | null;
  reputationScore: number | ReputationContext;
  /** 0–1 Sybil / farming risk from timing clusters and rate signals. */
  behavioralRisk?: number;
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
    const failed = input.ruleResult.checks
      .filter((c) => !c.passed && !c.soft)
      .map((c) => c.code);
    reasons.push(`Rule failure: ${failed.join(", ") || "unknown"}`);
    return { outcome: "REJECT", confidence: 0, reasons };
  }

  const softFails = input.ruleResult.checks.filter((c) => !c.passed && c.soft);
  if (softFails.length > 0) {
    reasons.push(`Soft rule flags: ${softFails.map((c) => c.code).join(", ")}`);
  }

  const behavioralRisk = Math.max(0, Math.min(1, input.behavioralRisk ?? 0));
  if (behavioralRisk >= 0.7) {
    reasons.push(`High behavioral risk (${behavioralRisk.toFixed(2)}) — manual review.`);
    return {
      outcome: "MANUAL_REVIEW",
      confidence: input.aiResult?.confidence ?? 0.4,
      reasons,
    };
  }

  if (!input.aiResult) {
    reasons.push("AI verifier unavailable — fail closed to manual review.");
    return { outcome: "MANUAL_REVIEW", confidence: 0.4, reasons };
  }

  const { confidence, recommendation, signals } = input.aiResult;
  const rep = effectiveReputation(input.reputationScore);
  const { auto, light } = thresholdsFor(input.reputationScore);
  reasons.push(`AI confidence=${confidence.toFixed(2)} recommendation=${recommendation}`);
  reasons.push(`Thresholds auto≥${auto.toFixed(2)} light≥${light.toFixed(2)} (rep=${rep})`);

  if (recommendation === "reject" || confidence < 0.25) {
    reasons.push("AI recommended reject or confidence critically low.");
    return { outcome: "REJECT", confidence, reasons };
  }

  const dup = Number((signals as Record<string, unknown>).duplicateProbability ?? 0);
  if (Number.isFinite(dup) && dup >= 0.85) {
    reasons.push("High duplicate probability — manual review.");
    return { outcome: "MANUAL_REVIEW", confidence, reasons };
  }

  const textClone = Number((signals as Record<string, unknown>).textCloneProbability ?? 0);
  if (Number.isFinite(textClone) && textClone >= 0.9) {
    reasons.push("Near-duplicate text submission — manual review.");
    return { outcome: "MANUAL_REVIEW", confidence, reasons };
  }

  const tamper = Number((signals as Record<string, unknown>).editLikelihood ?? 0);
  if (Number.isFinite(tamper) && tamper >= 0.85) {
    reasons.push("Possible screenshot tampering — manual review.");
    return { outcome: "MANUAL_REVIEW", confidence, reasons };
  }

  // Soft rule / moderate behavioral risk: never auto-approve.
  const blockAuto = softFails.length > 0 || behavioralRisk >= 0.4;

  if (recommendation === "approve" && confidence >= auto && !blockAuto) {
    reasons.push("High confidence auto-approve.");
    return { outcome: "AUTO_APPROVE", confidence, reasons };
  }

  if (confidence >= light || recommendation === "review" || blockAuto) {
    reasons.push(blockAuto ? "Elevated risk — light review." : "Medium confidence — light review.");
    return { outcome: "LIGHT_REVIEW", confidence, reasons };
  }

  reasons.push("Low confidence — manual moderation.");
  return { outcome: "MANUAL_REVIEW", confidence, reasons };
}
