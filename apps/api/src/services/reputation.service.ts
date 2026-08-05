import type { PrismaClient } from "@nimiqearn/database";
import type { VerificationOutcome } from "@nimiqearn/shared";

/**
 * Adjust contributor reputation after a verification / review outcome.
 * Positive for accepts; negative for rejects and fraud flags.
 */
export function createReputationService(db: PrismaClient) {
  return {
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
