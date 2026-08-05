import type { PrismaClient } from "@nimiqearn/database";
import {
  aiVerifyResponseSchema,
  type AiVerifyResponse,
  type VerificationConfig,
  type VerificationOutcome,
} from "@nimiqearn/shared";
import {
  appendRuleChecks,
  decide,
  runRuleEngine,
  type DecisionResult,
  type RuleResult,
} from "@nimiqearn/verification";
import {
  behavioralRiskFromCounts,
  enrichOnChainChecks,
  enrichReferralChecks,
  enrichSocialChecks,
  parseVerificationConfig,
} from "./verification-enrichment.js";

export interface VerifierConfig {
  url?: string;
  sharedSecret?: string;
  rpcUrl?: string;
}

export interface VerifySubmissionInput {
  submissionId: string;
  userId: string;
  workerTelegramId: string;
  proofType: string;
  proof: string;
  proofInstructions: string;
  title: string;
  reputationScore: number;
  acceptanceRate?: number;
  ageDays?: number;
  verificationConfig?: VerificationConfig | unknown;
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
     * Run deterministic rules → enrichers → AI verifier → decision engine.
     * Persists verification fields + a ModerationEvent.
     */
    async verifySubmission(input: VerifySubmissionInput): Promise<VerifySubmissionResult> {
      let ruleResult = runRuleEngine({
        proofType: input.proofType,
        proof: input.proof,
      });

      const vcfg = parseVerificationConfig(input.verificationConfig);

      if (ruleResult.passed) {
        if (input.proofType === "TRANSACTION_HASH") {
          ruleResult = appendRuleChecks(
            ruleResult,
            await enrichOnChainChecks({
              proof: input.proof,
              rpcUrl: config.rpcUrl,
              config: vcfg,
            }),
          );
        } else if (input.proofType === "LINK") {
          ruleResult = appendRuleChecks(
            ruleResult,
            await enrichSocialChecks({
              proof: input.proof,
              proofInstructions: input.proofInstructions,
              config: vcfg,
            }),
          );
        } else if (input.proofType === "REFERRAL_EVENT") {
          const raw = input.proof.trim().replace(/^@/, "");
          const referred = await db.user.findFirst({
            where: {
              OR: [{ telegramId: raw }, { telegramUsername: raw.replace(/^@/, "") }],
            },
            select: { id: true, telegramId: true, status: true },
          });
          let referredHasActivity = false;
          if (referred) {
            const [subs, wallets] = await Promise.all([
              db.questSubmission.count({ where: { userId: referred.id } }),
              db.walletProfile.count({ where: { userId: referred.id } }),
            ]);
            referredHasActivity = subs + wallets > 0;
          }
          ruleResult = appendRuleChecks(
            ruleResult,
            enrichReferralChecks({
              workerTelegramId: input.workerTelegramId,
              proof: input.proof,
              referred,
              referredHasActivity,
            }),
          );
        }
      }

      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [submissionsLastHour, submissionsLastDay, hourRows] = await Promise.all([
        db.questSubmission.count({
          where: { userId: input.userId, createdAt: { gte: hourAgo } },
        }),
        db.questSubmission.count({
          where: { userId: input.userId, createdAt: { gte: dayAgo } },
        }),
        db.questSubmission.findMany({
          where: { userId: input.userId, createdAt: { gte: hourAgo } },
          select: { questId: true },
        }),
      ]);
      const distinctQuestsLastHour = new Set(hourRows.map((r) => r.questId)).size;
      const { risk: behavioralRisk, checks: behaviorChecks } = behavioralRiskFromCounts({
        submissionsLastHour,
        submissionsLastDay,
        distinctQuestsLastHour,
      });
      if (ruleResult.passed) {
        ruleResult = appendRuleChecks(ruleResult, behaviorChecks);
      }

      let recentImageHashes: string[] = [];
      let recentTextProofs: string[] = [];
      if (ruleResult.passed && input.proofType === "SCREENSHOT") {
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
      if (ruleResult.passed && input.proofType === "TEXT") {
        const recent = await db.questSubmission.findMany({
          where: {
            id: { not: input.submissionId },
            quest: { proofType: "TEXT" },
            createdAt: { gte: dayAgo },
          },
          orderBy: { createdAt: "desc" },
          take: 40,
          select: { proof: true },
        });
        recentTextProofs = recent.map((r) => r.proof).filter((p) => p.length < 2000);
      }

      const aiResult = ruleResult.passed
        ? await callAiVerifier(config, {
            submissionId: input.submissionId,
            proofType: input.proofType,
            proof: input.proof,
            proofInstructions: input.proofInstructions,
            title: input.title,
            recentImageHashes,
            recentTextProofs,
            behavioralRisk,
          })
        : null;

      const decision = decide({
        ruleResult,
        aiResult,
        reputationScore: {
          score: input.reputationScore,
          acceptanceRate: input.acceptanceRate,
          ageDays: input.ageDays,
        },
        behavioralRisk,
      });

      const signals = {
        rules: ruleResult.checks,
        ai: aiResult?.signals ?? null,
        decisionReasons: decision.reasons,
        aiRecommendation: aiResult?.recommendation ?? null,
        imageHash: aiResult?.imageHash ?? null,
        behavioralRisk,
        verificationConfig: vcfg ?? null,
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
              behavioralRisk,
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
