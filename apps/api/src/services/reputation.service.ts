import type { PrismaClient } from "@nimiqearn/database";
import type { VerificationOutcome } from "@nimiqearn/shared";

export interface ReputationProfile {
  score: number;
  acceptanceRate: number;
  ageDays: number;
  accepted: number;
  rejected: number;
}

/**
 * Adjust contributor reputation after a verification / review outcome.
 * Positive for accepts; negative for rejects and fraud flags.
 */
export function createReputationService(db: PrismaClient) {
  return {
    async getProfile(userId: string): Promise<ReputationProfile> {
      const user = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { reputationScore: true, createdAt: true },
      });
      const [accepted, rejected] = await Promise.all([
        db.questSubmission.count({ where: { userId, status: "ACCEPTED" } }),
        db.questSubmission.count({ where: { userId, status: "REJECTED" } }),
      ]);
      const decided = accepted + rejected;
      const acceptanceRate = decided === 0 ? 0.5 : accepted / decided;
      const ageDays = Math.max(
        0,
        (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000),
      );
      return {
        score: user.reputationScore,
        acceptanceRate,
        ageDays,
        accepted,
        rejected,
      };
    },

    async applyOutcome(userId: string, outcome: VerificationOutcome | "CREATOR_ACCEPT" | "CREATOR_REJECT") {
      let delta = 0;
      switch (outcome) {
        case "AUTO_APPROVE":
        case "CREATOR_ACCEPT":
          delta = 2;
          break;
        case "LIGHT_REVIEW":
        case "MANUAL_REVIEW":
          delta = 0;
          break;
        case "REJECT":
        case "CREATOR_REJECT":
          delta = -3;
          break;
        default:
          delta = 0;
      }
      if (delta === 0) return;
      await db.user.update({
        where: { id: userId },
        data: { reputationScore: { increment: delta } },
      });
    },
  };
}

export type ReputationService = ReturnType<typeof createReputationService>;
