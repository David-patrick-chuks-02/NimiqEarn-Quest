import type { PrismaClient } from "@nimiqearn/database";
import {
  aiVerifyResponseSchema,
  type AiVerifyResponse,
  type VerificationOutcome,
} from "@nimiqearn/shared";
import { decide, runRuleEngine, type DecisionResult, type RuleResult } from "@nimiqearn/verification";

export interface VerifierConfig {
  url?: string;
  sharedSecret?: string;
}

export interface VerifySubmissionInput {
  submissionId: string;
  userId: string;
  proofType: string;
  proof: string;
  proofInstructions: string;
  title: string;
  reputationScore: number;
}

export interface VerifySubmissionResult {
  ruleResult: RuleResult;
  aiResult: AiVerifyResponse | null;
  decision: DecisionResult;
}

async function callAiVerifier(
  config: VerifierConfig,
  body: Record<string, unknown>,
): Promise<AiVerifyResponse | null> {
  if (!config.url) return null;
  const base = config.url.replace(/\/$/, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.sharedSecret) headers["x-verifier-key"] = config.sharedSecret;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${base}/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("Verifier HTTP error", res.status);
      return null;
    }
    const json = await res.json();
    const parsed = aiVerifyResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error("Verifier response invalid", parsed.error.flatten());
      return null;
    }
    return parsed.data;
  } catch (err) {
    console.error("Verifier unreachable", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function createVerificationService(db: PrismaClient, config: VerifierConfig = {}) {
  return {
    /**
     * Run deterministic rules → AI verifier → decision engine.
     * Persists verification fields + a ModerationEvent.
     */
    async verifySubmission(input: VerifySubmissionInput): Promise<VerifySubmissionResult> {
      const ruleResult = runRuleEngine({
        proofType: input.proofType,
        proof: input.proof,
      });

      let recentImageHashes: string[] = [];
      if (input.proofType === "SCREENSHOT" && ruleResult.passed) {
        const recent = await db.questSubmission.findMany({
          where: {
            id: { not: input.submissionId },
            quest: { proofType: "SCREENSHOT" },
          },
          orderBy: { createdAt: "desc" },
          take: 80,
          select: { verificationSignals: true },
        });
        recentImageHashes = recent
          .map((r) => {
            const s = r.verificationSignals as { imageHash?: string } | null;
            return s?.imageHash;
          })
          .filter((h): h is string => typeof h === "string" && h.length > 0);
      }

      const aiResult = ruleResult.passed
        ? await callAiVerifier(config, {
            submissionId: input.submissionId,
            proofType: input.proofType,
            proof: input.proof,
            proofInstructions: input.proofInstructions,
            title: input.title,
            recentImageHashes,
          })
        : null;

      const decision = decide({
        ruleResult,
        aiResult,
        reputationScore: input.reputationScore,
      });

      const signals = {
        rules: ruleResult.checks,
        ai: aiResult?.signals ?? null,
        decisionReasons: decision.reasons,
        aiRecommendation: aiResult?.recommendation ?? null,
        imageHash: aiResult?.imageHash ?? null,
      };

      await db.questSubmission.update({
        where: { id: input.submissionId },
        data: {
          verificationOutcome: decision.outcome,
          confidenceScore: decision.confidence,
          verificationSignals: JSON.parse(JSON.stringify(signals)),
          verifiedAt: new Date(),
        },
      });

      await db.moderationEvent.create({
        data: {
          submissionId: input.submissionId,
          userId: input.userId,
          flagType: "VERIFICATION",
          resolution: decision.outcome,
          detail: JSON.parse(
            JSON.stringify({
              confidence: decision.confidence,
              reasons: decision.reasons,
              rulePassed: ruleResult.passed,
              aiAvailable: Boolean(aiResult),
            }),
          ),
        },
      });

      return { ruleResult, aiResult, decision };
    },
  };
}

export type VerificationService = ReturnType<typeof createVerificationService>;

export type { VerificationOutcome };
