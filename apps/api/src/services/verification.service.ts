import { createHash } from "node:crypto";
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
  hardCheck,
  runRuleEngine,
  softCheck,
  type DecisionResult,
  type RuleResult,
} from "@nimiqearn/verification";
import {
  behavioralRiskFromCounts,
  enrichOnChainChecks,
  enrichReferralChecks,
  enrichSocialChecks,
  enrichWalletInteractionChecks,
  hashIp,
  parseVerificationConfig,
} from "./verification-enrichment.js";
import { fetchSocialPost } from "./social-fetch.js";

export interface VerifierConfig {
  url?: string;
  sharedSecret?: string;
  rpcUrl?: string;
}

export interface VerifySubmissionInput {
  submissionId: string;
  userId: string;
  workerTelegramId: string;
  workerAddress?: string | null;
  proofType: string;
  proof: string;
  proofInstructions: string;
  title: string;
  sampleEvidence?: string | null;
  questCategory?: string;
  reputationScore: number;
  acceptanceRate?: number;
  ageDays?: number;
  violationCount?: number;
  categoryConsistency?: number;
  verificationConfig?: VerificationConfig | unknown;
  clientFingerprint?: string | null;
  clientIp?: string | null;
}

export interface VerifySubmissionResult {
  ruleResult: RuleResult;
  aiResult: AiVerifyResponse | null;
  decision: DecisionResult;
  contentHash: string | null;
  moderationQueue: "CREATOR" | "PLATFORM" | null;
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

function textContentHash(proof: string): string {
  return createHash("sha256").update(proof.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export function createVerificationService(db: PrismaClient, config: VerifierConfig = {}) {
  return {
    async verifySubmission(input: VerifySubmissionInput): Promise<VerifySubmissionResult> {
      let ruleResult = runRuleEngine({
        proofType: input.proofType,
        proof: input.proof,
      });

      const vcfg = parseVerificationConfig(input.verificationConfig);
      let livePostText = "";

      if (ruleResult.passed) {
        if (input.proofType === "TRANSACTION_HASH") {
          ruleResult = appendRuleChecks(
            ruleResult,
            await enrichOnChainChecks({
              proof: input.proof,
              rpcUrl: config.rpcUrl,
              config: vcfg,
              workerAddress: input.workerAddress,
            }),
          );
        } else if (input.proofType === "WALLET_INTERACTION") {
          ruleResult = appendRuleChecks(
            ruleResult,
            enrichWalletInteractionChecks({
              proof: input.proof,
              config: vcfg,
              workerAddress: input.workerAddress,
            }),
          );
        } else if (input.proofType === "LINK") {
          const social = await enrichSocialChecks({
            proof: input.proof,
            proofInstructions: input.proofInstructions,
            config: vcfg,
          });
          ruleResult = appendRuleChecks(ruleResult, social.checks);
          livePostText = social.livePostText;
        } else if (input.proofType === "REFERRAL_EVENT") {
          const raw = input.proof.trim().replace(/^@/, "");
          const referred = await db.user.findFirst({
            where: {
              OR: [{ telegramId: raw }, { telegramUsername: raw.replace(/^@/, "") }],
            },
            select: { id: true, telegramId: true, status: true, referredById: true },
          });
          let referredHasActivity = false;
          let referredCompletedQuest = false;
          let farmingClusterSize = 0;
          let inboundReferralCount = 0;
          let sharedDeviceWithReferrer = false;
          if (referred) {
            const [subs, wallets, accepted, cluster, inbound, referredSubs, referrerSubs] =
              await Promise.all([
                db.questSubmission.count({ where: { userId: referred.id } }),
                db.walletProfile.count({ where: { userId: referred.id } }),
                db.questSubmission.count({
                  where: { userId: referred.id, status: "ACCEPTED" },
                }),
                db.referralEdge.count({ where: { referrerId: input.userId } }),
                db.referralEdge.count({ where: { referredId: referred.id } }),
                input.clientFingerprint
                  ? db.questSubmission.findFirst({
                      where: {
                        userId: referred.id,
                        clientFingerprint: input.clientFingerprint,
                      },
                      select: { id: true },
                    })
                  : Promise.resolve(null),
                input.clientFingerprint
                  ? db.questSubmission.findFirst({
                      where: {
                        userId: input.userId,
                        clientFingerprint: input.clientFingerprint,
                      },
                      select: { id: true },
                    })
                  : Promise.resolve(null),
              ]);
            referredHasActivity = subs + wallets > 0;
            referredCompletedQuest = accepted > 0;
            farmingClusterSize = cluster;
            inboundReferralCount = inbound;
            sharedDeviceWithReferrer = Boolean(referredSubs && referrerSubs);
          }
          const requireFirst =
            vcfg?.requireFirstQuest ?? input.questCategory === "REFERRAL";
          ruleResult = appendRuleChecks(
            ruleResult,
            enrichReferralChecks({
              workerTelegramId: input.workerTelegramId,
              proof: input.proof,
              referred,
              referredHasActivity,
              referredCompletedQuest,
              requireFirstQuest: requireFirst,
              farmingClusterSize,
              sharedDeviceWithReferrer,
              inboundReferralCount,
            }),
          );

          if (referred && ruleResult.passed) {
            await db.referralEdge
              .upsert({
                where: {
                  referrerId_referredId: {
                    referrerId: input.userId,
                    referredId: referred.id,
                  },
                },
                create: {
                  referrerId: input.userId,
                  referredId: referred.id,
                },
                update: {},
              })
              .catch(() => undefined);
            if (!referred.telegramId) {
              /* noop */
            }
            await db.user
              .updateMany({
                where: { id: referred.id, referredById: null },
                data: { referredById: input.userId },
              })
              .catch(() => undefined);
          }
        }

        // Screenshot ↔ live post consistency when livePostUrl configured.
        if (
          (input.proofType === "SCREENSHOT" || input.proofType === "UPLOADED_MEDIA") &&
          vcfg?.livePostUrl
        ) {
          const snap = await fetchSocialPost(vcfg.livePostUrl);
          livePostText = snap.text;
          ruleResult = appendRuleChecks(ruleResult, [
            softCheck(
              "live_post_available",
              snap.exists && !snap.deleted,
              snap.exists
                ? "Live post fetched for screenshot match."
                : "Could not fetch live post for screenshot match.",
            ),
          ]);
        }

        if (vcfg?.deadlineAt && input.proofType !== "TRANSACTION_HASH") {
          const ok = Date.now() <= vcfg.deadlineAt.getTime();
          ruleResult = appendRuleChecks(ruleResult, [
            hardCheck(
              "campaign_deadline",
              ok,
              ok ? "Within campaign deadline." : "Campaign deadline has passed.",
            ),
          ]);
        }
      }

      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const ipHash = input.clientIp ? hashIp(input.clientIp) : null;
      const fingerprint = input.clientFingerprint?.slice(0, 128) || null;

      const [submissionsLastHour, submissionsLastDay, hourRows, sharedFp, sharedIp] =
        await Promise.all([
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
          fingerprint
            ? db.questSubmission.findMany({
                where: {
                  clientFingerprint: fingerprint,
                  userId: { not: input.userId },
                  createdAt: { gte: dayAgo },
                },
                select: { userId: true },
                take: 50,
              })
            : Promise.resolve([]),
          ipHash
            ? db.questSubmission.findMany({
                where: {
                  ipHash,
                  userId: { not: input.userId },
                  createdAt: { gte: dayAgo },
                },
                select: { userId: true },
                take: 50,
              })
            : Promise.resolve([]),
        ]);

      const distinctQuestsLastHour = new Set(hourRows.map((r) => r.questId)).size;
      const sharedFingerprintUsers = new Set(sharedFp.map((r) => r.userId)).size;
      const sharedIpUsers = new Set(sharedIp.map((r) => r.userId)).size;

      let recentImageHashes: string[] = [];
      let recentTextProofs: string[] = [];
      let contentClusterUsers = 0;
      let provisionalContentHash: string | null = null;

      if (ruleResult.passed && (input.proofType === "SCREENSHOT" || input.proofType === "UPLOADED_MEDIA")) {
        const recent = await db.questSubmission.findMany({
          where: {
            id: { not: input.submissionId },
            OR: [
              { quest: { proofType: "SCREENSHOT" } },
              { quest: { proofType: "UPLOADED_MEDIA" } },
              { contentHash: { not: null } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: { verificationSignals: true, contentHash: true, userId: true },
        });
        recentImageHashes = recent
          .map((r) => {
            const s = r.verificationSignals as { imageHash?: string } | null;
            return s?.imageHash ?? r.contentHash ?? undefined;
          })
          .filter((h): h is string => typeof h === "string" && h.length > 0);
      }

      if (ruleResult.passed && (input.proofType === "TEXT" || input.proofType === "REFERRAL_EVENT")) {
        provisionalContentHash = textContentHash(input.proof);
        const recent = await db.questSubmission.findMany({
          where: {
            id: { not: input.submissionId },
            createdAt: { gte: dayAgo },
            OR: [{ contentHash: provisionalContentHash }, { quest: { proofType: "TEXT" } }],
          },
          orderBy: { createdAt: "desc" },
          take: 80,
          select: { proof: true, contentHash: true, userId: true },
        });
        recentTextProofs = recent.map((r) => r.proof).filter((p) => p.length < 2000);
        contentClusterUsers = new Set(
          recent
            .filter((r) => r.contentHash === provisionalContentHash)
            .map((r) => r.userId),
        ).size;
      }

      const { risk: behavioralRisk, checks: behaviorChecks } = behavioralRiskFromCounts({
        submissionsLastHour,
        submissionsLastDay,
        distinctQuestsLastHour,
        sharedFingerprintUsers,
        sharedIpUsers,
        contentClusterUsers,
      });
      if (ruleResult.passed) {
        ruleResult = appendRuleChecks(ruleResult, behaviorChecks);
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
            sampleEvidence: input.sampleEvidence ?? undefined,
            livePostText: livePostText || undefined,
          })
        : null;

      const decision = decide({
        ruleResult,
        aiResult,
        reputationScore: {
          score: input.reputationScore,
          acceptanceRate: input.acceptanceRate,
          ageDays: input.ageDays,
          violationCount: input.violationCount,
          categoryConsistency: input.categoryConsistency,
        },
        behavioralRisk,
      });

      const contentHash =
        aiResult?.imageHash ??
        provisionalContentHash ??
        (typeof (aiResult?.signals as { imageHash?: string } | undefined)?.imageHash === "string"
          ? (aiResult!.signals as { imageHash: string }).imageHash
          : null);

      // Cross-account image cluster after we know the hash.
      if (contentHash && ruleResult.passed) {
        const cluster = await db.questSubmission.findMany({
          where: {
            contentHash,
            userId: { not: input.userId },
            id: { not: input.submissionId },
          },
          select: { userId: true },
          take: 100,
        });
        const clusterUsers = new Set(cluster.map((c) => c.userId)).size;
        if (clusterUsers >= 5 && decision.outcome === "AUTO_APPROVE") {
          decision.outcome = "MANUAL_REVIEW";
          decision.reasons.push(
            `Cross-account content cluster (${clusterUsers} users) — platform review.`,
          );
        }
      }

      let moderationQueue: "CREATOR" | "PLATFORM" | null = null;
      if (decision.outcome === "LIGHT_REVIEW") moderationQueue = "CREATOR";
      if (decision.outcome === "MANUAL_REVIEW") moderationQueue = "PLATFORM";

      const signals = {
        rules: ruleResult.checks,
        ai: aiResult?.signals ?? null,
        decisionReasons: decision.reasons,
        aiRecommendation: aiResult?.recommendation ?? null,
        imageHash: aiResult?.imageHash ?? null,
        behavioralRisk,
        verificationConfig: vcfg ?? null,
        livePostPreview: livePostText.slice(0, 280) || null,
        sharedFingerprintUsers,
        sharedIpUsers,
        contentClusterUsers,
      };

      await db.questSubmission.update({
        where: { id: input.submissionId },
        data: {
          verificationOutcome: decision.outcome,
          confidenceScore: decision.confidence,
          verificationSignals: JSON.parse(JSON.stringify(signals)),
          verifiedAt: new Date(),
          contentHash,
          clientFingerprint: fingerprint,
          ipHash,
          moderationQueue,
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
              moderationQueue,
            }),
          ),
        },
      });

      return { ruleResult, aiResult, decision, contentHash, moderationQueue };
    },
  };
}

export type VerificationService = ReturnType<typeof createVerificationService>;

export type { VerificationOutcome };
