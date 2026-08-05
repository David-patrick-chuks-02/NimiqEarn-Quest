import type { PrismaClient } from "@nimiqearn/database";
import type { VerificationOutcome } from "@nimiqearn/shared";

export interface ReputationProfile {
  score: number;
  acceptanceRate: number;
  ageDays: number;
  accepted: number;
  rejected: number;
  /** Count of fraud / policy violation events. */
  violationCount: number;
  /**
   * 0–1 consistency of acceptance across quest categories (1 = even success,
   * low = only succeeds in one niche / farms one type).
   */
  categoryConsistency: number;
}

type OutcomeKind = VerificationOutcome | "CREATOR_ACCEPT" | "CREATOR_REJECT";

/**
 * Adjust contributor reputation after a verification / review outcome.
 * Tracks violation history, applies inactivity decay, and measures category consistency.
 */
export function createReputationService(db: PrismaClient) {
  return {
    async getProfile(userId: string): Promise<ReputationProfile> {
      // Apply inactivity decay once per day when score > 0 and idle ≥ 30 days.
      await this.applyDecayIfNeeded(userId);

      const user = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { reputationScore: true, createdAt: true },
      });
      const [accepted, rejected, violations, byCategory] = await Promise.all([
        db.questSubmission.count({ where: { userId, status: "ACCEPTED" } }),
        db.questSubmission.count({ where: { userId, status: "REJECTED" } }),
        db.reputationEvent.count({
          where: {
            userId,
            OR: [
              { kind: { startsWith: "VIOLATION" } },
              { kind: { in: ["REJECT", "CREATOR_REJECT"] } },
            ],
          },
        }),
        db.questSubmission.findMany({
          where: { userId, status: { in: ["ACCEPTED", "REJECTED"] } },
          select: {
            status: true,
            quest: { select: { category: true } },
          },
          take: 500,
        }),
      ]);
      const decided = accepted + rejected;
      const acceptanceRate = decided === 0 ? 0.5 : accepted / decided;
      const ageDays = Math.max(
        0,
        (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000),
      );

      const catMap = new Map<string, { ok: number; total: number }>();
      for (const row of byCategory) {
        const cat = row.quest.category;
        const entry = catMap.get(cat) ?? { ok: 0, total: 0 };
        entry.total += 1;
        if (row.status === "ACCEPTED") entry.ok += 1;
        catMap.set(cat, entry);
      }
      let categoryConsistency = 0.5;
      if (catMap.size >= 2) {
        const rates = [...catMap.values()]
          .filter((c) => c.total >= 2)
          .map((c) => c.ok / c.total);
        if (rates.length >= 2) {
          const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
          const variance =
            rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
          categoryConsistency = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) * 2));
        } else {
          categoryConsistency = 0.55;
        }
      } else if (catMap.size === 1) {
        categoryConsistency = 0.45; // single-category history is slightly less trusted
      }

      return {
        score: user.reputationScore,
        acceptanceRate,
        ageDays,
        accepted,
        rejected,
        violationCount: violations,
        categoryConsistency,
      };
    },

    async applyDecayIfNeeded(userId: string): Promise<void> {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { reputationScore: true, reputationDecayedAt: true },
      });
      if (!user || user.reputationScore <= 0) return;

      const now = Date.now();
      if (
        user.reputationDecayedAt &&
        now - user.reputationDecayedAt.getTime() < 24 * 60 * 60 * 1000
      ) {
        return;
      }

      const last = await db.questSubmission.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      const idleMs = last
        ? now - last.createdAt.getTime()
        : now - (user.reputationDecayedAt?.getTime() ?? now);
      if (idleMs < 30 * 24 * 60 * 60 * 1000) {
        await db.user.update({
          where: { id: userId },
          data: { reputationDecayedAt: new Date() },
        });
        return;
      }

      const delta = -Math.min(5, Math.max(1, Math.floor(idleMs / (30 * 24 * 60 * 60 * 1000))));
      await db.$transaction([
        db.user.update({
          where: { id: userId },
          data: {
            reputationScore: { increment: delta },
            reputationDecayedAt: new Date(),
          },
        }),
        db.reputationEvent.create({
          data: {
            userId,
            kind: "DECAY",
            delta,
            detail: { idleDays: Math.floor(idleMs / (24 * 60 * 60 * 1000)) },
          },
        }),
      ]);
    },

    async applyOutcome(
      userId: string,
      outcome: OutcomeKind,
      meta: { questCategory?: string } = {},
    ) {
      let delta = 0;
      let kind: string = outcome;
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
      await db.$transaction([
        db.user.update({
          where: { id: userId },
          data: { reputationScore: { increment: delta } },
        }),
        db.reputationEvent.create({
          data: {
            userId,
            kind,
            delta,
            category: meta.questCategory ?? null,
          },
        }),
      ]);
    },

    async recordViolation(
      userId: string,
      kind: string,
      detail: Record<string, unknown> = {},
    ) {
      const delta = kind === "DUP" || kind === "TAMPER" ? -5 : -2;
      await db.$transaction([
        db.user.update({
          where: { id: userId },
          data: { reputationScore: { increment: delta } },
        }),
        db.reputationEvent.create({
          data: {
            userId,
            kind: kind.startsWith("VIOLATION") ? kind : `VIOLATION_${kind}`,
            delta,
            category: typeof detail.questCategory === "string" ? detail.questCategory : null,
            detail: JSON.parse(JSON.stringify(detail)),
          },
        }),
      ]);
    },
  };
}

export type ReputationService = ReturnType<typeof createReputationService>;
