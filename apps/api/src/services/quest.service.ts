import type { PrismaClient, Quest } from "@nimiqearn/database";
import type { CreateQuestInput, UpdateQuestInput } from "@nimiqearn/shared";
import { createQuestSchema, questStatusSchema, updateQuestSchema } from "@nimiqearn/shared";
import { createProfileService, ProfileServiceError } from "./profile.service.js";
import type { EscrowService, QuestFunding } from "./escrow.service.js";

export class QuestServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "USER_NOT_FOUND"
      | "NOT_CREATOR"
      | "SUSPENDED"
      | "INVALID_QUEST"
      | "QUEST_NOT_FOUND"
      | "INVALID_STATUS"
      | "NOT_VERIFIED"
      | "NO_WALLET"
      | "INSUFFICIENT_BALANCE"
      | "RPC_UNAVAILABLE"
      | "FUNDING_FAILED"
      | "QUEST_NOT_PUBLISHED"
      | "CREATOR_CANNOT_SUBMIT"
      | "QUEST_FULL"
      | "QUEST_EXPIRED"
      | "ALREADY_SUBMITTED"
      | "INVALID_PROOF"
      | "PAYOUT_FAILED",
  ) {
    super(message);
    this.name = "QuestServiceError";
  }
}

function isCreatorRole(role: string) {
  return role === "CREATOR" || role === "ADMIN";
}

export function createQuestService(db: PrismaClient, escrow?: EscrowService) {
  const profiles = createProfileService(db);

  return {
    async createDraftQuest(telegramId: string, input: CreateQuestInput): Promise<Quest> {
      const parsed = createQuestSchema.safeParse(input);
      if (!parsed.success) {
        throw new QuestServiceError("Invalid quest data.", "INVALID_QUEST");
      }

      if (parsed.data.deadline <= new Date()) {
        throw new QuestServiceError("Deadline must be in the future.", "INVALID_QUEST");
      }

      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfiles: true },
      });
      if (!user) {
        throw new QuestServiceError("User not found.", "USER_NOT_FOUND");
      }
      if (!isCreatorRole(user.role)) {
        throw new QuestServiceError("Creator access required.", "NOT_CREATOR");
      }

      try {
        profiles.assertVerifiedProfile(user);
      } catch (error) {
        if (error instanceof ProfileServiceError) {
          throw new QuestServiceError(error.message, error.code);
        }
        throw error;
      }

      // Provision a dedicated escrow wallet for this quest, if escrow is configured. The
      // creator funds it with the total reward pool before the quest can go live.
      const wallet = escrow?.enabled ? escrow.createWallet() : null;

      return db.quest.create({
        data: {
          creatorId: user.id,
          title: parsed.data.title,
          category: parsed.data.category,
          description: parsed.data.description,
          rewardAmount: parsed.data.rewardAmount,
          totalSlots: parsed.data.totalSlots,
          deadline: parsed.data.deadline,
          proofType: parsed.data.proofType,
          proofInstructions: parsed.data.proofInstructions,
          status: "DRAFT",
          escrowAddress: wallet?.address ?? null,
          escrowKeyCiphertext: wallet?.keyCiphertext ?? null,
        },
      });
    },

    async updateDraftQuest(
      telegramId: string,
      questId: string,
      input: UpdateQuestInput,
    ): Promise<Quest> {
      const parsed = updateQuestSchema.safeParse(input);
      if (!parsed.success) {
        throw new QuestServiceError("Invalid quest data.", "INVALID_QUEST");
      }

      if (parsed.data.deadline && parsed.data.deadline <= new Date()) {
        throw new QuestServiceError("Deadline must be in the future.", "INVALID_QUEST");
      }

      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfiles: true },
      });
      if (!user) {
        throw new QuestServiceError("User not found.", "USER_NOT_FOUND");
      }
      if (!isCreatorRole(user.role)) {
        throw new QuestServiceError("Creator access required.", "NOT_CREATOR");
      }

      try {
        profiles.assertVerifiedProfile(user);
      } catch (error) {
        if (error instanceof ProfileServiceError) {
          throw new QuestServiceError(error.message, error.code);
        }
        throw error;
      }

      const quest = await db.quest.findFirst({
        where: { id: questId, creatorId: user.id },
      });
      if (!quest) {
        throw new QuestServiceError("Quest not found.", "QUEST_NOT_FOUND");
      }
      if (quest.status !== "DRAFT") {
        throw new QuestServiceError("Only draft quests can be edited.", "INVALID_STATUS");
      }

      return db.quest.update({
        where: { id: quest.id },
        data: parsed.data,
      });
    },

    async listCreatorQuests(telegramId: string, status?: string) {
      const user = await db.user.findUnique({ where: { telegramId } });
      if (!user) {
        throw new QuestServiceError("User not found.", "USER_NOT_FOUND");
      }
      if (!isCreatorRole(user.role)) {
        throw new QuestServiceError("Creator access required.", "NOT_CREATOR");
      }

      let statusFilter: Quest["status"] | undefined;
      if (status) {
        const parsedStatus = questStatusSchema.safeParse(status);
        if (!parsedStatus.success) {
          throw new QuestServiceError("Invalid status filter.", "INVALID_STATUS");
        }
        statusFilter = parsedStatus.data;
      }

      return db.quest.findMany({
        where: {
          creatorId: user.id,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    },

    async publishQuest(telegramId: string, questId: string): Promise<Quest> {
      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfiles: true },
      });
      if (!user) {
        throw new QuestServiceError("User not found.", "USER_NOT_FOUND");
      }
      if (!isCreatorRole(user.role)) {
        throw new QuestServiceError("Creator access required.", "NOT_CREATOR");
      }

      try {
        profiles.assertVerifiedProfile(user);
      } catch (error) {
        if (error instanceof ProfileServiceError) {
          throw new QuestServiceError(error.message, error.code);
        }
        throw error;
      }

      const quest = await db.quest.findFirst({
        where: { id: questId, creatorId: user.id },
      });
      if (!quest) {
        throw new QuestServiceError("Quest not found.", "QUEST_NOT_FOUND");
      }
      if (quest.status !== "DRAFT") {
        throw new QuestServiceError("Only draft quests can be published.", "INVALID_STATUS");
      }
      if (quest.deadline <= new Date()) {
        throw new QuestServiceError("Deadline must be in the future.", "INVALID_QUEST");
      }

      // Fund the quest from the creator's custodial wallet: transfer the full reward pool
      // to the quest's escrow wallet on-chain. This is where the creator "pays" for the quest.
      let fundedAt: Date | null = null;
      if (escrow?.enabled && quest.escrowAddress) {
        const creatorWallet = user.walletProfiles.find((w) => w.keyCiphertext);
        if (!creatorWallet?.keyCiphertext) {
          throw new QuestServiceError("Set up your wallet before publishing.", "NO_WALLET");
        }

        const requiredLuna = escrow.requiredLuna(Number(quest.rewardAmount), quest.totalSlots);
        const balance = await escrow.getFunding(creatorWallet.nimiqAddress, requiredLuna);
        if (!balance.reachable) {
          throw new QuestServiceError(
            "Couldn't reach the Nimiq network. Please try again shortly.",
            "RPC_UNAVAILABLE",
          );
        }
        if (!balance.funded) {
          const have = balance.balanceNim ?? 0;
          throw new QuestServiceError(
            `Insufficient balance — you need ${balance.requiredNim.toLocaleString()} NIM but have ${have.toLocaleString()}. Top up your wallet and try again.`,
            "INSUFFICIENT_BALANCE",
          );
        }

        const result = await escrow.transfer({
          fromKeyCiphertext: creatorWallet.keyCiphertext,
          toAddress: quest.escrowAddress,
          valueLuna: BigInt(requiredLuna),
        });
        if (!result.hash) {
          throw new QuestServiceError(
            result.error ?? "Funding the quest failed. Please try again.",
            "FUNDING_FAILED",
          );
        }
        fundedAt = new Date();
      }

      return db.quest.update({
        where: { id: quest.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          ...(fundedAt ? { fundedAt } : {}),
        },
      });
    },

    /**
     * Public, unauthenticated view of a single PUBLISHED quest (for shareable links).
     * Counts the view. Returns null for drafts/closed/missing quests.
     */
    async getPublicQuest(questId: string) {
      const quest = await db.quest.findFirst({
        where: { id: questId, status: "PUBLISHED" },
        include: { creator: { select: { displayName: true } } },
      });
      if (!quest) return null;
      // Best-effort view tracking — never block or fail the read on it. We keep the
      // running counter (cheap reads) AND append a timestamped event (time-series charts).
      await Promise.all([
        db.quest
          .update({ where: { id: quest.id }, data: { viewCount: { increment: 1 } } })
          .catch(() => undefined),
        db.questEvent.create({ data: { questId: quest.id, type: "VIEW" } }).catch(() => undefined),
      ]);
      return quest;
    },

    /** Live escrow funding status for a single quest the caller owns. */
    async getQuestFunding(telegramId: string, questId: string): Promise<QuestFunding | null> {
      const user = await db.user.findUnique({ where: { telegramId } });
      if (!user) {
        throw new QuestServiceError("User not found.", "USER_NOT_FOUND");
      }
      if (!isCreatorRole(user.role)) {
        throw new QuestServiceError("Creator access required.", "NOT_CREATOR");
      }

      const quest = await db.quest.findFirst({ where: { id: questId, creatorId: user.id } });
      if (!quest) {
        throw new QuestServiceError("Quest not found.", "QUEST_NOT_FOUND");
      }
      if (!escrow?.enabled || !quest.escrowAddress) {
        return null; // escrow not configured for this quest
      }

      const requiredLuna = escrow.requiredLuna(Number(quest.rewardAmount), quest.totalSlots);
      return escrow.getFunding(quest.escrowAddress, requiredLuna);
    },

    /**
     * Per-quest analytics for the creator "Manage Quests" view: a snapshot of the
     * headline numbers plus a daily time-series of views and fills over a trailing
     * window, so the studio can render trend charts. Caller must own the quest.
     */
    async getQuestAnalytics(
      telegramId: string,
      questId: string,
      windowDays = 30,
    ): Promise<QuestAnalytics> {
      const user = await db.user.findUnique({ where: { telegramId } });
      if (!user) {
        throw new QuestServiceError("User not found.", "USER_NOT_FOUND");
      }
      if (!isCreatorRole(user.role)) {
        throw new QuestServiceError("Creator access required.", "NOT_CREATOR");
      }

      const quest = await db.quest.findFirst({ where: { id: questId, creatorId: user.id } });
      if (!quest) {
        throw new QuestServiceError("Quest not found.", "QUEST_NOT_FOUND");
      }

      // Trailing window of whole UTC days, ending today. Start at midnight so day
      // buckets line up with the date keys we group on.
      const days = Math.max(1, Math.min(90, windowDays));
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() - (days - 1));

      const events = await db.questEvent.findMany({
        where: { questId, createdAt: { gte: start } },
        select: { type: true, createdAt: true },
      });

      // Pre-seed every day in the window with zeros so the chart has no gaps.
      const buckets = new Map<string, { views: number; fills: number }>();
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        buckets.set(d.toISOString().slice(0, 10), { views: 0, fills: 0 });
      }
      for (const ev of events) {
        const key = ev.createdAt.toISOString().slice(0, 10);
        const bucket = buckets.get(key);
        if (!bucket) continue;
        if (ev.type === "VIEW") bucket.views += 1;
        else if (ev.type === "FILL") bucket.fills += 1;
      }
      const series = [...buckets.entries()].map(([date, v]) => ({ date, ...v }));

      const reward = Number(quest.rewardAmount);
      const pool = reward * quest.totalSlots;
      const committed = reward * quest.filledSlots;
      const conversionRate = quest.viewCount > 0 ? quest.filledSlots / quest.viewCount : 0;
      const msLeft = quest.deadline.getTime() - Date.now();
      const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));

      return {
        id: quest.id,
        title: quest.title,
        status: quest.status,
        rewardAmount: reward,
        totalSlots: quest.totalSlots,
        filledSlots: quest.filledSlots,
        slotsLeft: Math.max(0, quest.totalSlots - quest.filledSlots),
        viewCount: quest.viewCount,
        pool,
        committed,
        remainingPool: Math.max(0, pool - committed),
        conversionRate,
        deadline: quest.deadline.toISOString(),
        daysLeft,
        publishedAt: quest.publishedAt?.toISOString() ?? null,
        createdAt: quest.createdAt.toISOString(),
        windowDays: days,
        series,
      };
    },

    /**
     * Worker-facing view of a published quest: the public quest plus this worker's context
     * (whether they own it, already submitted, and whether they can still submit + why not).
     * Returns null if the quest isn't available (missing / not published).
     */
    async getWorkerQuestView(telegramId: string, questId: string): Promise<WorkerQuestView | null> {
      const quest = await db.quest.findFirst({
        where: { id: questId, status: "PUBLISHED" },
        include: { creator: { select: { displayName: true } } },
      });
      if (!quest) return null;

      const user = await db.user.findUnique({ where: { telegramId } });
      const existing = user
        ? await db.questSubmission.findUnique({
            where: { questId_userId: { questId, userId: user.id } },
          })
        : null;

      const isCreator = Boolean(user) && quest.creatorId === user!.id;
      const slotsLeft = Math.max(0, quest.totalSlots - quest.filledSlots);
      const expired = quest.deadline.getTime() <= Date.now();

      let canSubmit = true;
      let reason: WorkerQuestView["reason"] = null;
      if (!user) {
        canSubmit = false;
        reason = "NOT_REGISTERED";
      } else if (isCreator) {
        canSubmit = false;
        reason = "CREATOR";
      } else if (existing) {
        canSubmit = false;
        reason = "ALREADY_SUBMITTED";
      } else if (slotsLeft <= 0) {
        canSubmit = false;
        reason = "FULL";
      } else if (expired) {
        canSubmit = false;
        reason = "EXPIRED";
      }

      return {
        quest: toPublicQuestResponse(quest),
        isCreator,
        submitted: Boolean(existing),
        canSubmit,
        reason,
      };
    },

    /**
     * Record a worker's proof for a quest, fill a slot, and pay the reward to their wallet.
     * Proof is auto-accepted (no creator review in this milestone) — our system is the
     * verifier. Guards against the creator doing their own quest, duplicates, a full quest,
     * and an expired deadline. When payments are configured the reward is disbursed on-chain
     * from the quest's escrow to the worker's custodial wallet immediately.
     */
    async submitQuest(
      telegramId: string,
      questId: string,
      proof: string,
    ): Promise<{ txHash: string | null }> {
      const trimmed = proof.trim();
      if (trimmed.length === 0 || trimmed.length > 2000) {
        throw new QuestServiceError(
          "Your submission must be between 1 and 2000 characters.",
          "INVALID_PROOF",
        );
      }

      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfiles: true },
      });
      if (!user) {
        throw new QuestServiceError("Send /start to register before doing quests.", "USER_NOT_FOUND");
      }

      const quest = await db.quest.findFirst({ where: { id: questId } });
      if (!quest) {
        throw new QuestServiceError("This quest isn't available.", "QUEST_NOT_FOUND");
      }
      if (quest.status !== "PUBLISHED") {
        throw new QuestServiceError("This quest isn't open for submissions.", "QUEST_NOT_PUBLISHED");
      }
      if (quest.creatorId === user.id) {
        throw new QuestServiceError("You can't complete your own quest.", "CREATOR_CANNOT_SUBMIT");
      }
      if (quest.deadline.getTime() <= Date.now()) {
        throw new QuestServiceError("This quest's deadline has passed.", "QUEST_EXPIRED");
      }

      // Pay the reward on accept when escrow is configured and the quest holds its own key.
      const willPay = Boolean(escrow?.enabled && quest.escrowKeyCiphertext);
      const workerWallet = user.walletProfiles.find((w) => w.nimiqAddress) ?? null;
      if (willPay && !workerWallet) {
        throw new QuestServiceError("Set up your wallet with /start before doing quests.", "NO_WALLET");
      }

      // Reserve a slot and record the submission atomically. The unique (quest,user) index
      // rejects a double-submit; the conditional increment prevents overselling slots.
      let submissionId: string;
      try {
        submissionId = await db.$transaction(async (tx) => {
          const submission = await tx.questSubmission.create({
            data: { questId, userId: user.id, proof: trimmed, status: "ACCEPTED" },
          });
          const reserved = await tx.quest.updateMany({
            where: { id: questId, filledSlots: { lt: quest.totalSlots } },
            data: { filledSlots: { increment: 1 } },
          });
          if (reserved.count === 0) {
            throw new QuestServiceError("This quest is already full.", "QUEST_FULL");
          }
          return submission.id;
        });
      } catch (error) {
        if (error instanceof QuestServiceError) throw error;
        if ((error as { code?: string }).code === "P2002") {
          throw new QuestServiceError("You've already done this quest.", "ALREADY_SUBMITTED");
        }
        throw error;
      }

      let txHash: string | null = null;
      if (willPay && workerWallet) {
        const rewardLuna = escrow!.requiredLuna(Number(quest.rewardAmount), 1);
        const result = await escrow!.transfer({
          fromKeyCiphertext: quest.escrowKeyCiphertext!,
          toAddress: workerWallet.nimiqAddress,
          valueLuna: BigInt(rewardLuna),
        });
        if (!result.hash) {
          // Payout failed — undo the slot + submission so the worker can retry cleanly.
          await db
            .$transaction(async (tx) => {
              await tx.questSubmission.delete({ where: { id: submissionId } });
              await tx.quest.updateMany({
                where: { id: questId, filledSlots: { gt: 0 } },
                data: { filledSlots: { decrement: 1 } },
              });
            })
            .catch(() => undefined);
          throw new QuestServiceError(
            result.error ?? "We couldn't pay your reward. Please try again.",
            "PAYOUT_FAILED",
          );
        }
        txHash = result.hash;
        await db.questSubmission
          .update({ where: { id: submissionId }, data: { payoutTxHash: txHash, paidAt: new Date() } })
          .catch(() => undefined);
      }

      // FILL marks a completed+paid slot — logged after payout so analytics stay honest.
      await db.questEvent.create({ data: { questId, type: "FILL" } }).catch(() => undefined);

      return { txHash };
    },
  };
}

export interface WorkerQuestView {
  quest: ReturnType<typeof toPublicQuestResponse>;
  isCreator: boolean;
  submitted: boolean;
  canSubmit: boolean;
  reason: "NOT_REGISTERED" | "CREATOR" | "ALREADY_SUBMITTED" | "FULL" | "EXPIRED" | null;
}

export interface QuestAnalytics {
  id: string;
  title: string;
  status: string;
  rewardAmount: number;
  totalSlots: number;
  filledSlots: number;
  slotsLeft: number;
  viewCount: number;
  pool: number;
  committed: number;
  remainingPool: number;
  conversionRate: number;
  deadline: string;
  daysLeft: number;
  publishedAt: string | null;
  createdAt: string;
  windowDays: number;
  series: { date: string; views: number; fills: number }[];
}

export type QuestService = ReturnType<typeof createQuestService>;

export function toQuestResponse(quest: Quest) {
  return {
    id: quest.id,
    title: quest.title,
    category: quest.category,
    description: quest.description,
    rewardAmount: quest.rewardAmount.toString(),
    totalSlots: quest.totalSlots,
    filledSlots: quest.filledSlots,
    deadline: quest.deadline.toISOString(),
    proofType: quest.proofType,
    proofInstructions: quest.proofInstructions,
    status: quest.status,
    createdAt: quest.createdAt.toISOString(),
    publishedAt: quest.publishedAt?.toISOString() ?? null,
    escrowAddress: quest.escrowAddress ?? null,
    fundedAt: quest.fundedAt?.toISOString() ?? null,
    viewCount: quest.viewCount,
  };
}

/** Public, share-safe quest shape — excludes escrow/ownership internals. */
export function toPublicQuestResponse(quest: Quest & { creator?: { displayName: string | null } }) {
  return {
    id: quest.id,
    title: quest.title,
    description: quest.description,
    category: quest.category,
    rewardAmount: quest.rewardAmount.toString(),
    totalSlots: quest.totalSlots,
    filledSlots: quest.filledSlots,
    slotsLeft: Math.max(0, quest.totalSlots - quest.filledSlots),
    deadline: quest.deadline.toISOString(),
    proofType: quest.proofType,
    proofInstructions: quest.proofInstructions,
    viewCount: quest.viewCount,
    publishedAt: quest.publishedAt?.toISOString() ?? null,
    creatorName: quest.creator?.displayName ?? null,
  };
}
