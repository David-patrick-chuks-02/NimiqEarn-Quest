import type { PrismaClient } from "@nimiqearn/database";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export function clampLimit(value?: number) {
  if (!value || !Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(value), MAX_LIMIT);
}

export function clampOffset(value?: number) {
  if (!value || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export function createAdminService(db: PrismaClient) {
  return {
    async listUsers(limit: number, offset: number) {
      const [total, items] = await Promise.all([
        db.user.count(),
        db.user.findMany({
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: { walletProfiles: { orderBy: { isPrimary: "desc" } } },
        }),
      ]);

      return {
        total,
        limit,
        offset,
        items: items.map((user) => ({
          id: user.id,
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername,
          displayName: user.displayName,
          role: user.role,
          status: user.status,
          reputationScore: user.reputationScore,
          walletCount: user.walletProfiles.length,
          primaryWalletStatus: user.walletProfiles[0]?.status ?? null,
          createdAt: user.createdAt.toISOString(),
        })),
      };
    },

    async listWallets(limit: number, offset: number) {
      const [total, items] = await Promise.all([
        db.walletProfile.count(),
        db.walletProfile.findMany({
          orderBy: { linkedAt: "desc" },
          skip: offset,
          take: limit,
          include: { user: { select: { telegramId: true, displayName: true } } },
        }),
      ]);

      return {
        total,
        limit,
        offset,
        items: items.map((wallet) => ({
          id: wallet.id,
          userId: wallet.userId,
          telegramId: wallet.user.telegramId,
          displayName: wallet.user.displayName,
          nimiqAddress: wallet.nimiqAddress,
          status: wallet.status,
          linkedAt: wallet.linkedAt.toISOString(),
          updatedAt: wallet.updatedAt.toISOString(),
        })),
      };
    },

    async listQuests(limit: number, offset: number) {
      const [total, items] = await Promise.all([
        db.quest.count(),
        db.quest.findMany({
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: { creator: { select: { telegramId: true, displayName: true } } },
        }),
      ]);

      return {
        total,
        limit,
        offset,
        items: items.map((quest) => ({
          id: quest.id,
          title: quest.title,
          category: quest.category,
          status: quest.status,
          rewardAmount: quest.rewardAmount.toString(),
          totalSlots: quest.totalSlots,
          filledSlots: quest.filledSlots,
          startAt: quest.startAt?.toISOString() ?? null,
          promoted: quest.promoted,
          creatorTelegramId: quest.creator.telegramId,
          creatorDisplayName: quest.creator.displayName,
          createdAt: quest.createdAt.toISOString(),
          publishedAt: quest.publishedAt?.toISOString() ?? null,
        })),
      };
    },

    async listSubmissions(limit: number, offset: number, outcome?: string) {
      const where =
        outcome && outcome.length > 0
          ? { verificationOutcome: outcome as never }
          : {};
      const [total, items] = await Promise.all([
        db.questSubmission.count({ where }),
        db.questSubmission.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: {
            user: { select: { telegramId: true, displayName: true, reputationScore: true } },
            quest: { select: { id: true, title: true, proofType: true } },
          },
        }),
      ]);

      return {
        total,
        limit,
        offset,
        items: items.map((s) => ({
          id: s.id,
          status: s.status,
          verificationOutcome: s.verificationOutcome,
          confidenceScore: s.confidenceScore,
          moderationQueue: s.moderationQueue,
          proofType: s.quest.proofType,
          questId: s.quest.id,
          questTitle: s.quest.title,
          telegramId: s.user.telegramId,
          displayName: s.user.displayName,
          reputationScore: s.user.reputationScore,
          proofPreview: s.proof.startsWith("data:")
            ? `[${s.proof.slice(5, s.proof.indexOf(";")) || "media"}]`
            : s.proof.slice(0, 280),
          decisionReasons: (() => {
            const sig = s.verificationSignals as { decisionReasons?: string[] } | null;
            return Array.isArray(sig?.decisionReasons) ? sig!.decisionReasons!.slice(0, 8) : [];
          })(),
          createdAt: s.createdAt.toISOString(),
          verifiedAt: s.verifiedAt?.toISOString() ?? null,
        })),
      };
    },

    async listPlatformQueue(limit: number, offset: number) {
      const where = {
        status: "PENDING" as const,
        OR: [
          { moderationQueue: "PLATFORM" },
          { verificationOutcome: "MANUAL_REVIEW" as const },
        ],
      };
      const [total, items] = await Promise.all([
        db.questSubmission.count({ where }),
        db.questSubmission.findMany({
          where,
          orderBy: { createdAt: "asc" },
          skip: offset,
          take: limit,
          include: {
            user: { select: { telegramId: true, displayName: true, reputationScore: true } },
            quest: { select: { id: true, title: true, proofType: true } },
          },
        }),
      ]);

      return {
        total,
        limit,
        offset,
        items: items.map((s) => ({
          id: s.id,
          status: s.status,
          verificationOutcome: s.verificationOutcome,
          confidenceScore: s.confidenceScore,
          moderationQueue: s.moderationQueue,
          proofType: s.quest.proofType,
          questId: s.quest.id,
          questTitle: s.quest.title,
          telegramId: s.user.telegramId,
          displayName: s.user.displayName,
          reputationScore: s.user.reputationScore,
          proofPreview: s.proof.startsWith("data:")
            ? `[${s.proof.slice(5, s.proof.indexOf(";")) || "media"}]`
            : s.proof.slice(0, 280),
          decisionReasons: (() => {
            const sig = s.verificationSignals as { decisionReasons?: string[] } | null;
            return Array.isArray(sig?.decisionReasons) ? sig!.decisionReasons!.slice(0, 8) : [];
          })(),
          createdAt: s.createdAt.toISOString(),
          verifiedAt: s.verifiedAt?.toISOString() ?? null,
        })),
      };
    },

    async listModerationEvents(limit: number, offset: number) {
      const [total, items] = await Promise.all([
        db.moderationEvent.count(),
        db.moderationEvent.findMany({
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
      ]);

      return {
        total,
        limit,
        offset,
        items: items.map((e) => ({
          id: e.id,
          submissionId: e.submissionId,
          userId: e.userId,
          flagType: e.flagType,
          resolution: e.resolution,
          detail: e.detail,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    },

    async setUserStatus(userId: string, status: "ACTIVE" | "SUSPENDED" | "PENDING") {
      const user = await db.user.update({
        where: { id: userId },
        data: { status },
        select: {
          id: true,
          telegramId: true,
          displayName: true,
          status: true,
          reputationScore: true,
        },
      });
      return user;
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
