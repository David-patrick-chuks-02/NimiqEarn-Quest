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
          deadline: quest.deadline.toISOString(),
          creatorTelegramId: quest.creator.telegramId,
          creatorDisplayName: quest.creator.displayName,
          createdAt: quest.createdAt.toISOString(),
          publishedAt: quest.publishedAt?.toISOString() ?? null,
        })),
      };
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
