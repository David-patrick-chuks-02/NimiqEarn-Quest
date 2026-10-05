import type { Prisma, PrismaClient } from "@nimiqearn/database";

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

function cleanQuery(q?: string) {
  const trimmed = q?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, 120) : undefined;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_RE.test(value);
}

function mapSubmission(
  s: {
    id: string;
    status: string;
    verificationOutcome: string | null;
    confidenceScore: number | null;
    moderationQueue: string | null;
    proof: string;
    verificationSignals: unknown;
    createdAt: Date;
    verifiedAt: Date | null;
    user: { telegramId: string; displayName: string | null; reputationScore: number };
    quest: { id: string; title: string; proofType: string };
  },
) {
  return {
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
  };
}

const submissionInclude = {
  user: { select: { telegramId: true, displayName: true, reputationScore: true } },
  quest: { select: { id: true, title: true, proofType: true } },
} as const;

const platformQueueWhere: Prisma.QuestSubmissionWhereInput = {
  status: "PENDING",
  OR: [{ moderationQueue: "PLATFORM" }, { verificationOutcome: "MANUAL_REVIEW" }],
};

export function createAdminService(db: PrismaClient) {
  return {
    async getOverview(queueLimit = 5) {
      const take = Math.min(Math.max(queueLimit, 1), 20);
      const [queue, submissions, quests, accounts, audit, feedback, queueItems] =
        await Promise.all([
          db.questSubmission.count({ where: platformQueueWhere }),
          db.questSubmission.count(),
          db.quest.count(),
          db.user.count(),
          db.moderationEvent.count(),
          db.feedback.count(),
          db.questSubmission.findMany({
            where: platformQueueWhere,
            orderBy: { createdAt: "asc" },
            take,
            include: submissionInclude,
          }),
        ]);

      return {
        counts: { queue, submissions, quests, accounts, audit, feedback },
        queue: queueItems.map(mapSubmission),
      };
    },

    async listUsers(limit: number, offset: number, q?: string) {
      const query = cleanQuery(q);
      const where: Prisma.UserWhereInput = query
        ? {
            OR: [
              { telegramId: { contains: query, mode: "insensitive" } },
              { telegramUsername: { contains: query, mode: "insensitive" } },
              { displayName: { contains: query, mode: "insensitive" } },
              ...(isUuid(query) ? [{ id: { equals: query } }] : []),
            ],
          }
        : {};

      const [total, items] = await Promise.all([
        db.user.count({ where }),
        db.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            telegramId: true,
            telegramUsername: true,
            displayName: true,
            role: true,
            status: true,
            reputationScore: true,
            createdAt: true,
            _count: { select: { walletProfiles: true } },
            walletProfiles: {
              where: { isPrimary: true },
              take: 1,
              select: { status: true },
            },
          },
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
          walletCount: user._count.walletProfiles,
          primaryWalletStatus: user.walletProfiles[0]?.status ?? null,
          createdAt: user.createdAt.toISOString(),
        })),
      };
    },

    async listWallets(limit: number, offset: number, q?: string) {
      const query = cleanQuery(q);
      const where: Prisma.WalletProfileWhereInput = query
        ? {
            OR: [
              { nimiqAddress: { contains: query, mode: "insensitive" } },
              { user: { telegramId: { contains: query, mode: "insensitive" } } },
              { user: { displayName: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {};

      const [total, items] = await Promise.all([
        db.walletProfile.count({ where }),
        db.walletProfile.findMany({
          where,
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

    async listQuests(limit: number, offset: number, q?: string) {
      const query = cleanQuery(q);
      const where: Prisma.QuestWhereInput = query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              ...(isUuid(query) ? [{ id: { equals: query } }] : []),
              { creator: { telegramId: { contains: query, mode: "insensitive" } } },
              { creator: { displayName: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {};

      const [total, items] = await Promise.all([
        db.quest.count({ where }),
        db.quest.findMany({
          where,
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
          proofType: quest.proofType,
          rewardAmount: quest.rewardAmount.toString(),
          totalSlots: quest.totalSlots,
          filledSlots: quest.filledSlots,
          viewCount: quest.viewCount,
          startAt: quest.startAt?.toISOString() ?? null,
          promoted: quest.promoted,
          escrowAddress: quest.escrowAddress,
          fundedAt: quest.fundedAt?.toISOString() ?? null,
          creatorTelegramId: quest.creator.telegramId,
          creatorDisplayName: quest.creator.displayName,
          createdAt: quest.createdAt.toISOString(),
          publishedAt: quest.publishedAt?.toISOString() ?? null,
        })),
      };
    },

    async getQuest(questId: string) {
      const quest = await db.quest.findUnique({
        where: { id: questId },
        include: {
          creator: {
            select: {
              id: true,
              telegramId: true,
              telegramUsername: true,
              displayName: true,
              role: true,
              status: true,
            },
          },
          submissions: {
            orderBy: { createdAt: "desc" },
            take: 50,
            include: {
              user: { select: { telegramId: true, displayName: true, reputationScore: true } },
            },
          },
          _count: { select: { submissions: true, events: true } },
        },
      });
      if (!quest) return null;

      const [accepted, rejected, pending] = await Promise.all([
        db.questSubmission.count({ where: { questId, status: "ACCEPTED" } }),
        db.questSubmission.count({ where: { questId, status: "REJECTED" } }),
        db.questSubmission.count({ where: { questId, status: "PENDING" } }),
      ]);

      return {
        id: quest.id,
        title: quest.title,
        category: quest.category,
        description: quest.description,
        rewardAmount: quest.rewardAmount.toString(),
        totalSlots: quest.totalSlots,
        filledSlots: quest.filledSlots,
        proofType: quest.proofType,
        proofInstructions: quest.proofInstructions,
        verificationConfig: quest.verificationConfig,
        status: quest.status,
        startAt: quest.startAt?.toISOString() ?? null,
        promoted: quest.promoted,
        createdAt: quest.createdAt.toISOString(),
        publishedAt: quest.publishedAt?.toISOString() ?? null,
        viewCount: quest.viewCount,
        escrowAddress: quest.escrowAddress,
        fundedAt: quest.fundedAt?.toISOString() ?? null,
        hasEscrowKey: Boolean(quest.escrowKeyCiphertext),
        sampleEvidence: quest.sampleEvidence
          ? quest.sampleEvidence.startsWith("data:")
            ? `[${quest.sampleEvidence.slice(5, quest.sampleEvidence.indexOf(";")) || "media"}]`
            : quest.sampleEvidence.slice(0, 120)
          : null,
        creator: quest.creator,
        counts: {
          submissions: quest._count.submissions,
          events: quest._count.events,
          accepted,
          rejected,
          pending,
        },
        recentSubmissions: quest.submissions.map((s) => ({
          id: s.id,
          status: s.status,
          verificationOutcome: s.verificationOutcome,
          confidenceScore: s.confidenceScore,
          moderationQueue: s.moderationQueue,
          payoutTxHash: s.payoutTxHash,
          paidAt: s.paidAt?.toISOString() ?? null,
          telegramId: s.user.telegramId,
          displayName: s.user.displayName,
          reputationScore: s.user.reputationScore,
          createdAt: s.createdAt.toISOString(),
        })),
      };
    },

    async getUser(userId: string) {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          walletProfiles: { orderBy: { isPrimary: "desc" } },
          quests: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              title: true,
              status: true,
              rewardAmount: true,
              totalSlots: true,
              filledSlots: true,
              createdAt: true,
              publishedAt: true,
            },
          },
          submissions: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { quest: { select: { id: true, title: true } } },
          },
          _count: {
            select: { quests: true, submissions: true, reputationEvents: true },
          },
        },
      });
      if (!user) return null;

      return {
        id: user.id,
        telegramId: user.telegramId,
        telegramUsername: user.telegramUsername,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        reputationScore: user.reputationScore,
        languageCode: user.languageCode,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        wallets: user.walletProfiles.map((w) => ({
          id: w.id,
          nimiqAddress: w.nimiqAddress,
          status: w.status,
          isPrimary: w.isPrimary,
          custodial: Boolean(w.keyCiphertext),
          linkedAt: w.linkedAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        })),
        counts: user._count,
        quests: user.quests.map((q) => ({
          ...q,
          rewardAmount: q.rewardAmount.toString(),
          createdAt: q.createdAt.toISOString(),
          publishedAt: q.publishedAt?.toISOString() ?? null,
        })),
        submissions: user.submissions.map((s) => ({
          id: s.id,
          status: s.status,
          verificationOutcome: s.verificationOutcome,
          questId: s.quest.id,
          questTitle: s.quest.title,
          payoutTxHash: s.payoutTxHash,
          createdAt: s.createdAt.toISOString(),
        })),
      };
    },

    async getSubmission(submissionId: string) {
      const s = await db.questSubmission.findUnique({
        where: { id: submissionId },
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              telegramUsername: true,
              displayName: true,
              reputationScore: true,
              status: true,
              role: true,
            },
          },
          quest: {
            select: {
              id: true,
              title: true,
              status: true,
              proofType: true,
              rewardAmount: true,
              creatorId: true,
              escrowAddress: true,
            },
          },
          moderationEvents: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      });
      if (!s) return null;

      return {
        id: s.id,
        status: s.status,
        verificationOutcome: s.verificationOutcome,
        confidenceScore: s.confidenceScore,
        verificationSignals: s.verificationSignals,
        moderationQueue: s.moderationQueue,
        proof: s.proof.startsWith("data:")
          ? `[${s.proof.slice(5, s.proof.indexOf(";")) || "media"} length=${s.proof.length}]`
          : s.proof,
        contentHash: s.contentHash,
        clientFingerprint: s.clientFingerprint,
        ipHash: s.ipHash,
        payoutTxHash: s.payoutTxHash,
        paidAt: s.paidAt?.toISOString() ?? null,
        verifiedAt: s.verifiedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        user: s.user,
        quest: {
          ...s.quest,
          rewardAmount: s.quest.rewardAmount.toString(),
        },
        moderationEvents: s.moderationEvents.map((e) => ({
          id: e.id,
          flagType: e.flagType,
          resolution: e.resolution,
          detail: e.detail,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    },

    async listSubmissions(limit: number, offset: number, outcome?: string, q?: string) {
      const query = cleanQuery(q);
      const where: Prisma.QuestSubmissionWhereInput = {
        ...(outcome && outcome.length > 0 ? { verificationOutcome: outcome as never } : {}),
        ...(query
          ? {
              OR: [
                ...(isUuid(query) ? [{ id: { equals: query } }, { quest: { id: { equals: query } } }] : []),
                { quest: { title: { contains: query, mode: "insensitive" } } },
                { user: { telegramId: { contains: query, mode: "insensitive" } } },
                { user: { displayName: { contains: query, mode: "insensitive" } } },
                { proof: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [total, items] = await Promise.all([
        db.questSubmission.count({ where }),
        db.questSubmission.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: submissionInclude,
        }),
      ]);

      return {
        total,
        limit,
        offset,
        items: items.map(mapSubmission),
      };
    },

    async listPlatformQueue(limit: number, offset: number, q?: string) {
      const query = cleanQuery(q);
      const where: Prisma.QuestSubmissionWhereInput = {
        ...platformQueueWhere,
        ...(query
          ? {
              AND: [
                {
                  OR: [
                    ...(isUuid(query) ? [{ id: { equals: query } }] : []),
                    { quest: { title: { contains: query, mode: "insensitive" } } },
                    { user: { telegramId: { contains: query, mode: "insensitive" } } },
                    { user: { displayName: { contains: query, mode: "insensitive" } } },
                  ],
                },
              ],
            }
          : {}),
      };

      const [total, items] = await Promise.all([
        db.questSubmission.count({ where }),
        db.questSubmission.findMany({
          where,
          orderBy: { createdAt: "asc" },
          skip: offset,
          take: limit,
          include: submissionInclude,
        }),
      ]);

      return {
        total,
        limit,
        offset,
        items: items.map(mapSubmission),
      };
    },

    async listModerationEvents(limit: number, offset: number, q?: string) {
      const query = cleanQuery(q);
      const where: Prisma.ModerationEventWhereInput = query
        ? {
            OR: [
              ...(isUuid(query)
                ? [{ submissionId: { equals: query } }, { id: { equals: query } }]
                : []),
              { flagType: { contains: query, mode: "insensitive" } },
              { resolution: { contains: query, mode: "insensitive" } },
            ],
          }
        : {};

      const [total, items] = await Promise.all([
        db.moderationEvent.count({ where }),
        db.moderationEvent.findMany({
          where,
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

    async listFeedback(limit: number, offset: number, q?: string) {
      const query = cleanQuery(q);
      const where: Prisma.FeedbackWhereInput = query
        ? {
            OR: [
              { displayName: { contains: query, mode: "insensitive" } },
              { telegramHandle: { contains: query, mode: "insensitive" } },
              { message: { contains: query, mode: "insensitive" } },
            ],
          }
        : {};

      const [total, items] = await Promise.all([
        db.feedback.count({ where }),
        db.feedback.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            displayName: true,
            telegramHandle: true,
            message: true,
            rating: true,
            createdAt: true,
          },
        }),
      ]);

      return { total, limit, offset, items };
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
