import type { PrismaClient, Quest } from "@nimiqearn/database";
import type { CreateQuestInput, UpdateQuestInput } from "@nimiqearn/shared";
import { createQuestSchema, questStatusSchema, updateQuestSchema } from "@nimiqearn/shared";
import { createProfileService, ProfileServiceError } from "./profile.service.js";
import type { EscrowService, QuestFunding } from "./escrow.service.js";
import type { TelegramNotifier } from "./telegram-notify.js";
import {
  createVerificationService,
  type VerifierConfig,
} from "./verification.service.js";
import { createReputationService } from "./reputation.service.js";
import { enqueuePayout, isPayoutQueueEnabled } from "./payout-queue.js";
import { hashIp } from "./verification-enrichment.js";

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
      | "PAYOUT_FAILED"
      | "QUEST_NOT_STARTED"
      | "REPUTATION_TOO_LOW"
      | "ALREADY_PROMOTED"
      | "PROMOTION_UNAVAILABLE"
      | "SUBMISSION_NOT_FOUND"
      | "NOT_PENDING"
      | "ALREADY_REVIEWED",
  ) {
    super(message);
    this.name = "QuestServiceError";
  }
}

function isCreatorRole(role: string) {
  return role === "CREATOR" || role === "ADMIN";
}

/** Validate proof against the quest's declared proofType. */
function normalizeSubmissionProof(proof: string, proofType: string): string {
  const trimmed = proof.trim();
  if (trimmed.length === 0) {
    throw new QuestServiceError("Your submission can't be empty.", "INVALID_PROOF");
  }

  const isImage =
    /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(trimmed) && trimmed.length <= 700_000;

  switch (proofType) {
    case "SCREENSHOT":
      if (!isImage) {
        throw new QuestServiceError(
          "This quest needs a screenshot upload (JPEG, PNG, or WebP).",
          "INVALID_PROOF",
        );
      }
      return trimmed;
    case "UPLOADED_MEDIA": {
      const mediaOk =
        /^data:(image\/(jpeg|jpg|png|webp)|video\/(mp4|webm|quicktime));base64,/i.test(trimmed) &&
        trimmed.length <= 2_500_000;
      if (!mediaOk) {
        throw new QuestServiceError(
          "This quest needs an image or video upload (JPEG/PNG/WebP/MP4/WebM).",
          "INVALID_PROOF",
        );
      }
      return trimmed;
    }
    case "LINK":
      if (trimmed.startsWith("data:")) {
        throw new QuestServiceError("This quest needs a link, not an image.", "INVALID_PROOF");
      }
      try {
        const u = new URL(trimmed);
        if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad proto");
      } catch {
        throw new QuestServiceError("Enter a valid http(s) link.", "INVALID_PROOF");
      }
      if (trimmed.length > 2000) {
        throw new QuestServiceError("That link is too long.", "INVALID_PROOF");
      }
      return trimmed;
    case "TRANSACTION_HASH":
      if (trimmed.startsWith("data:") || trimmed.length > 200 || !/^[a-fA-F0-9]+$/.test(trimmed)) {
        throw new QuestServiceError("Enter a valid transaction hash.", "INVALID_PROOF");
      }
      return trimmed;
    case "WALLET_INTERACTION":
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (
          typeof parsed.message !== "string" ||
          typeof parsed.publicKey !== "string" ||
          typeof parsed.signature !== "string"
        ) {
          throw new Error("bad shape");
        }
      } catch {
        throw new QuestServiceError(
          'Wallet proof must be JSON with message, publicKey, and signature.',
          "INVALID_PROOF",
        );
      }
      if (trimmed.length > 8_000) {
        throw new QuestServiceError("Wallet proof is too large.", "INVALID_PROOF");
      }
      return trimmed;
    case "TEXT":
    case "REFERRAL_EVENT":
    default:
      if (trimmed.startsWith("data:image/") || trimmed.startsWith("data:video/")) {
        throw new QuestServiceError("This quest needs text proof, not media.", "INVALID_PROOF");
      }
      if (trimmed.length > 2000) {
        throw new QuestServiceError(
          "Your submission must be between 1 and 2000 characters.",
          "INVALID_PROOF",
        );
      }
      return trimmed;
  }
}

export interface PlatformFees {
  /** Percent charged on top of the reward pool at publish (e.g. 6). */
  percent: number;
  /** Recipient address for platform + promotion fees. Unset = fees disabled. */
  address?: string;
  /** Flat fee in NIM to promote a quest. */
  promotionNim: number;
}

const DEFAULT_FEES: PlatformFees = { percent: 0, promotionNim: 0 };

export function createQuestService(
  db: PrismaClient,
  escrow?: EscrowService,
  fees: PlatformFees = DEFAULT_FEES,
  notifier?: TelegramNotifier,
  verifierConfig?: VerifierConfig,
) {
  const profiles = createProfileService(db);
  const verification = createVerificationService(db, verifierConfig ?? {});
  const reputation = createReputationService(db);

  return {
    async createDraftQuest(telegramId: string, input: CreateQuestInput): Promise<Quest> {
      const parsed = createQuestSchema.safeParse(input);
      if (!parsed.success) {
        throw new QuestServiceError("Invalid quest data.", "INVALID_QUEST");
      }

      if (parsed.data.startAt && parsed.data.startAt <= new Date()) {
        // A start time in the past just means "start now" — normalise it to null rather than
        // rejecting, so a slightly-stale client clock doesn't block creation.
        parsed.data.startAt = undefined;
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
          startAt: parsed.data.startAt ?? null,
          proofType: parsed.data.proofType,
          proofInstructions: parsed.data.proofInstructions,
          sampleEvidence: parsed.data.sampleEvidence ?? null,
          verificationConfig: parsed.data.verificationConfig
            ? JSON.parse(JSON.stringify(parsed.data.verificationConfig))
            : undefined,
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

      if (parsed.data.startAt && parsed.data.startAt <= new Date()) {
        parsed.data.startAt = undefined;
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
        data: {
          ...parsed.data,
          ...(parsed.data.verificationConfig !== undefined
            ? {
                verificationConfig: parsed.data.verificationConfig
                  ? JSON.parse(JSON.stringify(parsed.data.verificationConfig))
                  : null,
              }
            : {}),
        },
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
        // Promoted quests first, then newest.
        orderBy: [{ promoted: "desc" }, { createdAt: "desc" }],
      });
    },

    /**
     * Public discovery list: live, open, PUBLISHED quests for workers to browse. Promoted
     * first, then newest, paginated. "Open" = a free slot and past its start time. Optional
     * category filter. (Slot fullness can't be expressed in a Prisma `where` column-compare,
     * so we filter it in memory — fine at MVP scale.)
     */
    async listDiscoverableQuests(
      opts: { page?: number; pageSize?: number; category?: string; telegramId?: string } = {},
    ) {
      const now = new Date();

      // When a worker is identified (Mini App initData), hide quests they created and ones
      // they've already submitted, so browse only shows quests they can actually do.
      let excludeCreatorId: string | undefined;
      let doneQuestIds = new Set<string>();
      if (opts.telegramId) {
        const user = await db.user.findUnique({
          where: { telegramId: opts.telegramId },
          include: { submissions: { select: { questId: true } } },
        });
        if (user) {
          excludeCreatorId = user.id;
          doneQuestIds = new Set(user.submissions.map((s) => s.questId));
        }
      }

      const matching = await db.quest.findMany({
        where: {
          status: "PUBLISHED",
          OR: [{ startAt: null }, { startAt: { lte: now } }],
          ...(opts.category ? { category: opts.category as Quest["category"] } : {}),
          ...(excludeCreatorId ? { creatorId: { not: excludeCreatorId } } : {}),
        },
        include: { creator: { select: { displayName: true } } },
        orderBy: [{ promoted: "desc" }, { createdAt: "desc" }],
      });
      const open = matching.filter(
        (q) => q.filledSlots < q.totalSlots && !doneQuestIds.has(q.id),
      );
      const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 10));
      const page = Math.max(0, opts.page ?? 0);
      const start = page * pageSize;
      return {
        total: open.length,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(open.length / pageSize)),
        quests: open.slice(start, start + pageSize).map(toDiscoverQuestResponse),
      };
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
      // Fund the quest from the creator's custodial wallet: transfer the reward pool to the
      // quest's escrow wallet on-chain, plus the platform fee (charged on top) to the fee
      // wallet. This is where the creator "pays" for the quest.
      let fundedAt: Date | null = quest.fundedAt;
      if (escrow?.enabled && quest.escrowAddress) {
        const creatorWallet = user.walletProfiles.find((w) => w.keyCiphertext);
        if (!creatorWallet?.keyCiphertext) {
          throw new QuestServiceError("Set up your wallet before publishing.", "NO_WALLET");
        }

        const poolLuna = escrow.requiredLuna(Number(quest.rewardAmount), quest.totalSlots);
        const feeLuna =
          fees.address && fees.percent > 0 ? (poolLuna * BigInt(fees.percent)) / 100n : 0n;
        const totalLuna = poolLuna + feeLuna;

        // Already funded (e.g. prior attempt crashed after transfer) — just flip to PUBLISHED.
        if (!fundedAt) {
          const balance = await escrow.getFunding(creatorWallet.nimiqAddress, totalLuna);
          if (!balance.reachable) {
            throw new QuestServiceError(
              "Couldn't reach the Nimiq network. Please try again shortly.",
              "RPC_UNAVAILABLE",
            );
          }
          if (!balance.funded) {
            const have = balance.balanceNim ?? 0;
            throw new QuestServiceError(
              `Insufficient balance — you need ${balance.requiredNim.toLocaleString()} NIM (reward pool + ${fees.percent}% platform fee) but have ${have.toLocaleString()}. Top up your wallet and try again.`,
              "INSUFFICIENT_BALANCE",
            );
          }

          // Claim funding so a concurrent publish can't double-transfer.
          const claim = await db.quest.updateMany({
            where: { id: quest.id, status: "DRAFT", fundedAt: null },
            data: { fundedAt: new Date() },
          });
          if (claim.count === 0) {
            throw new QuestServiceError("Only draft quests can be published.", "INVALID_STATUS");
          }
          fundedAt = new Date();

          try {
            const result = await escrow.transfer({
              fromKeyCiphertext: creatorWallet.keyCiphertext,
              toAddress: quest.escrowAddress,
              valueLuna: poolLuna,
            });
            if (!result.hash) {
              await db.quest
                .updateMany({
                  where: { id: quest.id, status: "DRAFT" },
                  data: { fundedAt: null },
                })
                .catch(() => undefined);
              throw new QuestServiceError(
                result.error ?? "Funding the quest failed. Please try again.",
                "FUNDING_FAILED",
              );
            }

            // Collect the platform fee (best-effort — the quest is already funded).
            if (feeLuna > 0n && fees.address) {
              const feeResult = await escrow.transfer({
                fromKeyCiphertext: creatorWallet.keyCiphertext,
                toAddress: fees.address,
                valueLuna: feeLuna,
              });
              if (!feeResult.hash) {
                console.error("Platform fee transfer failed for quest", quest.id, feeResult.error);
              }
            }
          } catch (error) {
            if (error instanceof QuestServiceError) throw error;
            await db.quest
              .updateMany({
                where: { id: quest.id, status: "DRAFT" },
                data: { fundedAt: null },
              })
              .catch(() => undefined);
            throw error;
          }
        }
      }

      const published = await db.quest.updateMany({
        where: { id: quest.id, status: "DRAFT" },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          ...(fundedAt ? { fundedAt } : {}),
        },
      });
      if (published.count === 0) {
        throw new QuestServiceError("Only draft quests can be published.", "INVALID_STATUS");
      }
      const updated = await db.quest.findUniqueOrThrow({ where: { id: quest.id } });
      return updated;
    },

    /**
     * Public, unauthenticated view of a single PUBLISHED quest (for shareable links).
     * Counts the view unless `count` is false (used by OG-image/thumbnail reads so previews
     * and studio list cards don't inflate analytics). Returns null for drafts/closed/missing.
     */
    async getPublicQuest(questId: string, count = true) {
      const quest = await db.quest.findFirst({
        where: { id: questId, status: "PUBLISHED" },
        include: { creator: { select: { displayName: true } } },
      });
      if (!quest) return null;
      if (count) {
        // Best-effort view tracking — never block or fail the read on it. We keep the running
        // counter (cheap reads) AND append a timestamped event (time-series charts).
        await Promise.all([
          db.quest
            .update({ where: { id: quest.id }, data: { viewCount: { increment: 1 } } })
            .catch(() => undefined),
          db.questEvent.create({ data: { questId: quest.id, type: "VIEW" } }).catch(() => undefined),
        ]);
      }
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
      const scheduled = quest.startAt != null && quest.startAt.getTime() > Date.now();

      return {
        id: quest.id,
        title: quest.title,
        status: quest.status,
        promoted: quest.promoted,
        rewardAmount: reward,
        totalSlots: quest.totalSlots,
        filledSlots: quest.filledSlots,
        slotsLeft: Math.max(0, quest.totalSlots - quest.filledSlots),
        viewCount: quest.viewCount,
        pool,
        committed,
        remainingPool: Math.max(0, pool - committed),
        conversionRate,
        startAt: quest.startAt?.toISOString() ?? null,
        scheduled,
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
      const notStarted = quest.startAt != null && quest.startAt.getTime() > Date.now();
      const suspended = user?.status === "SUSPENDED";

      let canSubmit = true;
      let reason: WorkerQuestView["reason"] = null;
      if (!user) {
        canSubmit = false;
        reason = "NOT_REGISTERED";
      } else if (suspended) {
        canSubmit = false;
        reason = "SUSPENDED";
      } else if (isCreator) {
        canSubmit = false;
        reason = "CREATOR";
      } else if (existing) {
        canSubmit = false;
        reason = "ALREADY_SUBMITTED";
      } else if (notStarted) {
        canSubmit = false;
        reason = "NOT_STARTED";
      } else if (slotsLeft <= 0) {
        canSubmit = false;
        reason = "FULL";
      }

      return {
        quest: toPublicQuestResponse(quest),
        isCreator,
        submitted: Boolean(existing),
        submissionStatus: existing?.status ?? null,
        canSubmit,
        reason,
      };
    },

    /**
     * Record a worker's proof, reserve a slot, then run the hybrid verification pipeline
     * (deterministic rules → AI → decision). Auto-approve pays immediately; LIGHT_REVIEW
     * stays PENDING for the creator; MANUAL_REVIEW goes to the platform moderator queue.
     */
    async submitQuest(
      telegramId: string,
      questId: string,
      proof: string,
      opts: { clientFingerprint?: string; clientIp?: string } = {},
    ): Promise<{
      status: "PENDING" | "ACCEPTED" | "REJECTED";
      outcome: string | null;
      txHash: string | null;
      txUrl: string | null;
    }> {
      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfiles: true },
      });
      if (!user) {
        throw new QuestServiceError("Send /start to register before doing quests.", "USER_NOT_FOUND");
      }
      if (user.status === "SUSPENDED") {
        throw new QuestServiceError("Your account is suspended.", "SUSPENDED");
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
      if (quest.startAt != null && quest.startAt.getTime() > Date.now()) {
        throw new QuestServiceError("This quest hasn't started yet.", "QUEST_NOT_STARTED");
      }

      const vcfgRaw = quest.verificationConfig as { minReputation?: number } | null;
      if (
        typeof vcfgRaw?.minReputation === "number" &&
        user.reputationScore < vcfgRaw.minReputation
      ) {
        throw new QuestServiceError(
          `This quest requires reputation ≥ ${vcfgRaw.minReputation}.`,
          "REPUTATION_TOO_LOW",
        );
      }

      // Fast format check before reserving a slot (full rule engine runs in verification).
      const trimmed = normalizeSubmissionProof(proof, quest.proofType);

      const willPay = Boolean(escrow?.enabled && quest.escrowKeyCiphertext);
      const workerWallet = user.walletProfiles.find((w) => w.nimiqAddress) ?? null;
      if (willPay && !workerWallet) {
        throw new QuestServiceError("Set up your wallet with /start before doing quests.", "NO_WALLET");
      }

      let submissionId: string;
      try {
        submissionId = await db.$transaction(async (tx) => {
          const submission = await tx.questSubmission.create({
            data: {
              questId,
              userId: user.id,
              proof: trimmed,
              status: "PENDING",
              clientFingerprint: opts.clientFingerprint?.slice(0, 128) ?? null,
              ipHash: opts.clientIp ? hashIp(opts.clientIp) : null,
            },
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

      const repProfile = await reputation.getProfile(user.id);
      const { decision, aiResult } = await verification.verifySubmission({
        submissionId,
        userId: user.id,
        workerTelegramId: user.telegramId,
        workerAddress: workerWallet?.nimiqAddress ?? null,
        proofType: quest.proofType,
        proof: trimmed,
        proofInstructions: quest.proofInstructions,
        title: quest.title,
        sampleEvidence: quest.sampleEvidence,
        questCategory: quest.category,
        reputationScore: repProfile.score,
        acceptanceRate: repProfile.acceptanceRate,
        ageDays: repProfile.ageDays,
        violationCount: repProfile.violationCount,
        categoryConsistency: repProfile.categoryConsistency,
        verificationConfig: quest.verificationConfig,
        clientFingerprint: opts.clientFingerprint,
        clientIp: opts.clientIp,
      });

      // Extra reputation hits for high-confidence fraud signals.
      if (aiResult?.signals) {
        const sig = aiResult.signals as Record<string, unknown>;
        const dup = Number(sig.duplicateProbability ?? 0);
        const tamper = Number(sig.editLikelihood ?? 0);
        if (dup >= 0.9) {
          await reputation
            .recordViolation(user.id, "DUP", {
              submissionId,
              questCategory: quest.category,
              duplicateProbability: dup,
            })
            .catch(() => undefined);
        } else if (tamper >= 0.85) {
          await reputation
            .recordViolation(user.id, "TAMPER", {
              submissionId,
              questCategory: quest.category,
              editLikelihood: tamper,
            })
            .catch(() => undefined);
        }
      }

      if (decision.outcome === "REJECT") {
        await db.$transaction(async (tx) => {
          await tx.questSubmission.updateMany({
            where: { id: submissionId, status: "PENDING" },
            data: { status: "REJECTED" },
          });
          await tx.quest.updateMany({
            where: { id: questId, filledSlots: { gt: 0 } },
            data: { filledSlots: { decrement: 1 } },
          });
        });
        await reputation.applyOutcome(user.id, "REJECT", { questCategory: quest.category });
        void notifier?.notify(
          user.telegramId,
          `Your submission for "${quest.title}" was rejected by verification. You can try another quest.`,
        );
        return { status: "REJECTED", outcome: decision.outcome, txHash: null, txUrl: null };
      }

      if (decision.outcome === "AUTO_APPROVE") {
        const claimed = await db.questSubmission.updateMany({
          where: { id: submissionId, status: "PENDING" },
          data: { status: "ACCEPTED" },
        });
        if (claimed.count === 0) {
          return { status: "PENDING", outcome: decision.outcome, txHash: null, txUrl: null };
        }

        let txHash: string | null = null;
        let txUrl: string | null = null;
        if (willPay && workerWallet) {
          const rewardLuna = escrow!.requiredLuna(Number(quest.rewardAmount), 1);
          if (isPayoutQueueEnabled()) {
            const queued = await enqueuePayout({
              submissionId,
              questId,
              toAddress: workerWallet.nimiqAddress,
              valueLuna: rewardLuna.toString(),
              fromKeyCiphertext: quest.escrowKeyCiphertext!,
            });
            if (!queued) {
              throw new QuestServiceError("Payout queue unavailable.", "PAYOUT_FAILED");
            }
            void notifier?.notify(
              user.telegramId,
              `Verified — your ${Number(quest.rewardAmount).toLocaleString()} NIM reward for "${quest.title}" is being paid out.`,
            );
          } else {
            const result = await escrow!.transfer({
              fromKeyCiphertext: quest.escrowKeyCiphertext!,
              toAddress: workerWallet.nimiqAddress,
              valueLuna: rewardLuna,
            });
            if (!result.hash) {
              console.error("Auto-approve payout failed", {
                questId,
                submissionId,
                error: result.error,
              });
              // Leave ACCEPTED unpaid — creator/worker can retry via accept path.
              throw new QuestServiceError(
                result.error ?? "We couldn't pay your reward. Please try again shortly.",
                "PAYOUT_FAILED",
              );
            }
            txHash = result.hash;
            txUrl = escrow!.explorerTxUrl(txHash);
            await db.questSubmission.update({
              where: { id: submissionId },
              data: { payoutTxHash: txHash, paidAt: new Date() },
            });
            const rewardNim = Number(quest.rewardAmount).toLocaleString();
            void notifier?.notify(
              user.telegramId,
              `Verified — you earned ${rewardNim} NIM for "${quest.title}".\n\nView the payout: ${txUrl}`,
            );
          }
        } else {
          void notifier?.notify(
            user.telegramId,
            `Your submission for "${quest.title}" was auto-approved.`,
          );
        }
        await reputation.applyOutcome(user.id, "AUTO_APPROVE");
        await db.questEvent.create({ data: { questId, type: "FILL" } }).catch(() => undefined);
        return { status: "ACCEPTED", outcome: decision.outcome, txHash, txUrl };
      }

      // LIGHT_REVIEW → creator Studio; MANUAL_REVIEW → platform moderator queue.
      if (decision.outcome === "MANUAL_REVIEW") {
        void notifier?.notify(
          user.telegramId,
          `Thanks — your submission for "${quest.title}" was flagged for platform moderation. You'll hear back soon.`,
        );
      } else {
        void notifier?.notify(
          user.telegramId,
          `Thanks — your submission for "${quest.title}" is pending creator review. You'll be paid if it's accepted.`,
        );
      }
      return {
        status: "PENDING",
        outcome: decision.outcome,
        txHash: null,
        txUrl: null,
      };
    },

    /** Creator: list submissions for a quest they own (newest first). */
    async listQuestSubmissions(telegramId: string, questId: string) {
      const user = await db.user.findUnique({ where: { telegramId } });
      if (!user) throw new QuestServiceError("User not found.", "USER_NOT_FOUND");
      if (!isCreatorRole(user.role)) {
        throw new QuestServiceError("Creator access required.", "NOT_CREATOR");
      }
      const quest = await db.quest.findFirst({ where: { id: questId, creatorId: user.id } });
      if (!quest) throw new QuestServiceError("Quest not found.", "QUEST_NOT_FOUND");

      const subs = await db.questSubmission.findMany({
        where: { questId },
        include: {
          user: { select: { telegramId: true, telegramUsername: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        questId,
        proofType: quest.proofType,
        submissions: subs.map((s) => ({
          id: s.id,
          status: s.status,
          proof: s.proof,
          verificationOutcome: s.verificationOutcome,
          confidenceScore: s.confidenceScore,
          verificationSignals: s.verificationSignals,
          moderationQueue: s.moderationQueue,
          creatorCanReview:
            s.status === "PENDING" &&
            s.moderationQueue !== "PLATFORM" &&
            s.verificationOutcome !== "MANUAL_REVIEW",
          payoutTxHash: s.payoutTxHash,
          payoutTxUrl: s.payoutTxHash && escrow ? escrow.explorerTxUrl(s.payoutTxHash) : null,
          paidAt: s.paidAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
          worker: {
            telegramId: s.user.telegramId,
            username: s.user.telegramUsername,
            displayName: s.user.displayName,
          },
        })),
      };
    },

    /**
     * Creator accepts a PENDING submission: mark ACCEPTED and pay from escrow.
     * Idempotent on payoutTxHash — never rolls back an ambiguous RPC so we can't double-pay.
     */
    async acceptSubmission(
      telegramId: string,
      submissionId: string,
    ): Promise<{ txHash: string | null; txUrl: string | null }> {
      const user = await db.user.findUnique({ where: { telegramId } });
      if (!user) throw new QuestServiceError("User not found.", "USER_NOT_FOUND");
      if (!isCreatorRole(user.role)) {
        throw new QuestServiceError("Creator access required.", "NOT_CREATOR");
      }

      const submission = await db.questSubmission.findUnique({
        where: { id: submissionId },
        include: {
          quest: true,
          user: { include: { walletProfiles: true } },
        },
      });
      if (!submission || submission.quest.creatorId !== user.id) {
        throw new QuestServiceError("Submission not found.", "SUBMISSION_NOT_FOUND");
      }
      if (
        submission.verificationOutcome === "MANUAL_REVIEW" ||
        submission.moderationQueue === "PLATFORM"
      ) {
        throw new QuestServiceError(
          "This submission is in the platform moderator queue and can't be accepted in Studio.",
          "NOT_PENDING",
        );
      }
      if (submission.status === "REJECTED") {
        throw new QuestServiceError("This submission was already rejected.", "ALREADY_REVIEWED");
      }
      if (submission.status === "ACCEPTED" && submission.payoutTxHash) {
        const txUrl = escrow ? escrow.explorerTxUrl(submission.payoutTxHash) : null;
        return { txHash: submission.payoutTxHash, txUrl };
      }

      if (submission.status === "PENDING") {
        const claimed = await db.questSubmission.updateMany({
          where: { id: submissionId, status: "PENDING" },
          data: { status: "ACCEPTED" },
        });
        if (claimed.count === 0) {
          throw new QuestServiceError("This submission is no longer pending.", "NOT_PENDING");
        }
      } else if (submission.status !== "ACCEPTED") {
        throw new QuestServiceError("This submission is no longer pending.", "NOT_PENDING");
      }

      const quest = submission.quest;
      const willPay = Boolean(escrow?.enabled && quest.escrowKeyCiphertext);
      const workerWallet =
        submission.user.walletProfiles.find((w) => w.nimiqAddress) ?? null;

      let txHash: string | null = submission.payoutTxHash;
      let txUrl: string | null = txHash && escrow ? escrow.explorerTxUrl(txHash) : null;

      if (willPay && !txHash) {
        if (!workerWallet) {
          throw new QuestServiceError("Worker has no wallet for payout.", "NO_WALLET");
        }
        const rewardLuna = escrow!.requiredLuna(Number(quest.rewardAmount), 1);
        const result = await escrow!.transfer({
          fromKeyCiphertext: quest.escrowKeyCiphertext!,
          toAddress: workerWallet.nimiqAddress,
          valueLuna: rewardLuna,
        });
        if (!result.hash) {
          // Clear failure only — leave ACCEPTED unpaid so accept can be retried without
          // double-spend from deleting/recreating. Do not revert to PENDING after transfer
          // may have broadcast (ambiguous timeout).
          console.error("Quest payout failed", {
            questId: quest.id,
            submissionId,
            error: result.error,
          });
          throw new QuestServiceError(
            result.error ?? "We couldn't pay the reward. Please try again.",
            "PAYOUT_FAILED",
          );
        }
        txHash = result.hash;
        txUrl = escrow!.explorerTxUrl(txHash);
        await db.questSubmission.update({
          where: { id: submissionId },
          data: { payoutTxHash: txHash, paidAt: new Date() },
        });
        const rewardNim = Number(quest.rewardAmount).toLocaleString();
        void notifier?.notify(
          submission.user.telegramId,
          `Your submission for "${quest.title}" was accepted — you earned ${rewardNim} NIM.\n\nView the payout: ${txUrl}`,
        );
      } else if (!willPay) {
        void notifier?.notify(
          submission.user.telegramId,
          `Your submission for "${quest.title}" was accepted.`,
        );
      }

      await reputation.applyOutcome(submission.userId, "CREATOR_ACCEPT");
      await db.questEvent.create({ data: { questId: quest.id, type: "FILL" } }).catch(() => undefined);

      return { txHash, txUrl };
    },

    /** Creator rejects a PENDING submission and frees the reserved slot. */
    async rejectSubmission(telegramId: string, submissionId: string): Promise<void> {
      const user = await db.user.findUnique({ where: { telegramId } });
      if (!user) throw new QuestServiceError("User not found.", "USER_NOT_FOUND");
      if (!isCreatorRole(user.role)) {
        throw new QuestServiceError("Creator access required.", "NOT_CREATOR");
      }

      const submission = await db.questSubmission.findUnique({
        where: { id: submissionId },
        include: { quest: true, user: true },
      });
      if (!submission || submission.quest.creatorId !== user.id) {
        throw new QuestServiceError("Submission not found.", "SUBMISSION_NOT_FOUND");
      }
      if (
        submission.verificationOutcome === "MANUAL_REVIEW" ||
        submission.moderationQueue === "PLATFORM"
      ) {
        throw new QuestServiceError(
          "This submission is in the platform moderator queue and can't be rejected in Studio.",
          "NOT_PENDING",
        );
      }
      if (submission.status !== "PENDING") {
        throw new QuestServiceError("Only pending submissions can be rejected.", "NOT_PENDING");
      }

      await db.$transaction(async (tx) => {
        const rejected = await tx.questSubmission.updateMany({
          where: { id: submissionId, status: "PENDING" },
          data: { status: "REJECTED" },
        });
        if (rejected.count === 0) {
          throw new QuestServiceError("Only pending submissions can be rejected.", "NOT_PENDING");
        }
        await tx.quest.updateMany({
          where: { id: submission.questId, filledSlots: { gt: 0 } },
          data: { filledSlots: { decrement: 1 } },
        });
      });

      await reputation.applyOutcome(submission.userId, "CREATOR_REJECT");
      void notifier?.notify(
        submission.user.telegramId,
        `Your submission for "${submission.quest.title}" was not accepted. The slot has been freed.`,
      );
    },

    /**
     * Platform moderator accept for MANUAL_REVIEW queue (admin API).
     */
    async platformAcceptSubmission(
      submissionId: string,
    ): Promise<{ txHash: string | null; txUrl: string | null }> {
      const submission = await db.questSubmission.findUnique({
        where: { id: submissionId },
        include: {
          quest: true,
          user: { include: { walletProfiles: true } },
        },
      });
      if (!submission) {
        throw new QuestServiceError("Submission not found.", "SUBMISSION_NOT_FOUND");
      }
      if (submission.status !== "PENDING") {
        throw new QuestServiceError("Only pending submissions can be accepted.", "NOT_PENDING");
      }
      if (
        submission.moderationQueue !== "PLATFORM" &&
        submission.verificationOutcome !== "MANUAL_REVIEW"
      ) {
        throw new QuestServiceError(
          "Submission is not in the platform moderator queue.",
          "NOT_PENDING",
        );
      }

      const claimed = await db.questSubmission.updateMany({
        where: { id: submissionId, status: "PENDING" },
        data: { status: "ACCEPTED", moderationQueue: null },
      });
      if (claimed.count === 0) {
        throw new QuestServiceError("This submission is no longer pending.", "NOT_PENDING");
      }

      const quest = submission.quest;
      const willPay = Boolean(escrow?.enabled && quest.escrowKeyCiphertext);
      const workerWallet =
        submission.user.walletProfiles.find((w) => w.nimiqAddress) ?? null;

      let txHash: string | null = null;
      let txUrl: string | null = null;
      if (willPay) {
        if (!workerWallet) {
          throw new QuestServiceError("Worker has no wallet for payout.", "NO_WALLET");
        }
        const rewardLuna = escrow!.requiredLuna(Number(quest.rewardAmount), 1);
        if (isPayoutQueueEnabled()) {
          await enqueuePayout({
            submissionId,
            questId: quest.id,
            toAddress: workerWallet.nimiqAddress,
            valueLuna: rewardLuna.toString(),
            fromKeyCiphertext: quest.escrowKeyCiphertext!,
          });
        } else {
          const result = await escrow!.transfer({
            fromKeyCiphertext: quest.escrowKeyCiphertext!,
            toAddress: workerWallet.nimiqAddress,
            valueLuna: rewardLuna,
          });
          if (!result.hash) {
            throw new QuestServiceError(
              result.error ?? "Payout failed.",
              "PAYOUT_FAILED",
            );
          }
          txHash = result.hash;
          txUrl = escrow!.explorerTxUrl(txHash);
          await db.questSubmission.update({
            where: { id: submissionId },
            data: { payoutTxHash: txHash, paidAt: new Date() },
          });
        }
      }

      await reputation.applyOutcome(submission.userId, "CREATOR_ACCEPT");
      await db.moderationEvent.create({
        data: {
          submissionId,
          userId: submission.userId,
          flagType: "PLATFORM_REVIEW",
          resolution: "ACCEPTED",
          detail: { source: "admin" },
        },
      });
      await db.questEvent.create({ data: { questId: quest.id, type: "FILL" } }).catch(() => undefined);
      void notifier?.notify(
        submission.user.telegramId,
        `Platform moderation accepted your submission for "${quest.title}".`,
      );
      return { txHash, txUrl };
    },

    async platformRejectSubmission(submissionId: string): Promise<void> {
      const submission = await db.questSubmission.findUnique({
        where: { id: submissionId },
        include: { quest: true, user: true },
      });
      if (!submission) {
        throw new QuestServiceError("Submission not found.", "SUBMISSION_NOT_FOUND");
      }
      if (submission.status !== "PENDING") {
        throw new QuestServiceError("Only pending submissions can be rejected.", "NOT_PENDING");
      }
      if (
        submission.moderationQueue !== "PLATFORM" &&
        submission.verificationOutcome !== "MANUAL_REVIEW"
      ) {
        throw new QuestServiceError(
          "Submission is not in the platform moderator queue.",
          "NOT_PENDING",
        );
      }

      await db.$transaction(async (tx) => {
        const rejected = await tx.questSubmission.updateMany({
          where: { id: submissionId, status: "PENDING" },
          data: { status: "REJECTED", moderationQueue: null },
        });
        if (rejected.count === 0) {
          throw new QuestServiceError("Only pending submissions can be rejected.", "NOT_PENDING");
        }
        await tx.quest.updateMany({
          where: { id: submission.questId, filledSlots: { gt: 0 } },
          data: { filledSlots: { decrement: 1 } },
        });
      });

      await reputation.applyOutcome(submission.userId, "CREATOR_REJECT");
      await db.moderationEvent.create({
        data: {
          submissionId,
          userId: submission.userId,
          flagType: "PLATFORM_REVIEW",
          resolution: "REJECTED",
          detail: { source: "admin" },
        },
      });
      void notifier?.notify(
        submission.user.telegramId,
        `Platform moderation rejected your submission for "${submission.quest.title}".`,
      );
    },

    /**
     * Promote a published quest ("premium ad"): claim the flag first (prevents double-charge),
     * then charge the flat promotion fee. Rollback the flag only on a clear payment failure.
     */
    async promoteQuest(telegramId: string, questId: string): Promise<void> {
      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfiles: true },
      });
      if (!user) throw new QuestServiceError("User not found.", "USER_NOT_FOUND");
      if (!isCreatorRole(user.role)) {
        throw new QuestServiceError("Creator access required.", "NOT_CREATOR");
      }

      const quest = await db.quest.findFirst({ where: { id: questId, creatorId: user.id } });
      if (!quest) throw new QuestServiceError("Quest not found.", "QUEST_NOT_FOUND");
      if (quest.promoted) {
        throw new QuestServiceError("This quest is already promoted.", "ALREADY_PROMOTED");
      }
      if (quest.status !== "PUBLISHED") {
        throw new QuestServiceError("Only published quests can be promoted.", "INVALID_STATUS");
      }
      if (!escrow?.enabled || !fees.address || fees.promotionNim <= 0) {
        throw new QuestServiceError("Promotion isn't available right now.", "PROMOTION_UNAVAILABLE");
      }

      const wallet = user.walletProfiles.find((w) => w.keyCiphertext);
      if (!wallet?.keyCiphertext) {
        throw new QuestServiceError("Set up your wallet first.", "NO_WALLET");
      }

      const feeLuna = escrow.requiredLuna(fees.promotionNim, 1);
      const balance = await escrow.getFunding(wallet.nimiqAddress, feeLuna);
      if (!balance.reachable) {
        throw new QuestServiceError(
          "Couldn't reach the Nimiq network. Please try again shortly.",
          "RPC_UNAVAILABLE",
        );
      }
      if (!balance.funded) {
        throw new QuestServiceError(
          `Insufficient balance — promoting costs ${fees.promotionNim.toLocaleString()} NIM.`,
          "INSUFFICIENT_BALANCE",
        );
      }

      const claim = await db.quest.updateMany({
        where: { id: quest.id, promoted: false, status: "PUBLISHED" },
        data: { promoted: true },
      });
      if (claim.count === 0) {
        throw new QuestServiceError("This quest is already promoted.", "ALREADY_PROMOTED");
      }

      const result = await escrow.transfer({
        fromKeyCiphertext: wallet.keyCiphertext,
        toAddress: fees.address,
        valueLuna: feeLuna,
      });
      if (!result.hash) {
        await db.quest
          .updateMany({ where: { id: quest.id, promoted: true }, data: { promoted: false } })
          .catch(() => undefined);
        throw new QuestServiceError(
          result.error ?? "Promotion payment failed. Please try again.",
          "FUNDING_FAILED",
        );
      }
    },

    /**
     * A worker's own submission history + total NIM earned — for the earnings view.
     * Newest first; each item carries the quest title, reward, status, and payout tx hash.
     */
    async getWorkerSubmissions(telegramId: string): Promise<WorkerEarnings> {
      const user = await db.user.findUnique({ where: { telegramId } });
      if (!user) {
        throw new QuestServiceError("User not found.", "USER_NOT_FOUND");
      }
      const subs = await db.questSubmission.findMany({
        where: { userId: user.id },
        include: { quest: { select: { title: true, rewardAmount: true } } },
        orderBy: { createdAt: "desc" },
      });
      const submissions = subs.map((s) => ({
        id: s.id,
        questId: s.questId,
        questTitle: s.quest.title,
        reward: Number(s.quest.rewardAmount),
        status: s.status,
        payoutTxHash: s.payoutTxHash ?? null,
        // NimiqWatch explorer link for on-chain transparency (single source of truth).
        payoutTxUrl: s.payoutTxHash && escrow ? escrow.explorerTxUrl(s.payoutTxHash) : null,
        paidAt: s.paidAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      }));
      const totalEarned = submissions
        .filter((s) => s.status === "ACCEPTED")
        .reduce((sum, s) => sum + s.reward, 0);
      return { totalEarned, count: submissions.length, submissions };
    },
  };
}

export interface WorkerEarnings {
  totalEarned: number;
  count: number;
  submissions: {
    id: string;
    questId: string;
    questTitle: string;
    reward: number;
    status: string;
    payoutTxHash: string | null;
    payoutTxUrl: string | null;
    paidAt: string | null;
    createdAt: string;
  }[];
}

export interface WorkerQuestView {
  quest: ReturnType<typeof toPublicQuestResponse>;
  isCreator: boolean;
  submitted: boolean;
  submissionStatus: string | null;
  canSubmit: boolean;
  reason:
    | "NOT_REGISTERED"
    | "CREATOR"
    | "ALREADY_SUBMITTED"
    | "FULL"
    | "NOT_STARTED"
    | "SUSPENDED"
    | null;
}

export interface QuestAnalytics {
  id: string;
  title: string;
  status: string;
  promoted: boolean;
  rewardAmount: number;
  totalSlots: number;
  filledSlots: number;
  slotsLeft: number;
  viewCount: number;
  pool: number;
  committed: number;
  remainingPool: number;
  conversionRate: number;
  startAt: string | null;
  scheduled: boolean;
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
    startAt: quest.startAt?.toISOString() ?? null,
    scheduled: quest.startAt != null && quest.startAt.getTime() > Date.now(),
    promoted: quest.promoted,
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

/**
 * Lightweight quest shape for discovery/browse lists — the fields a card needs, without the
 * heavy `sampleEvidence` image or `proofInstructions` (fetched on the quest detail instead).
 */
export function toDiscoverQuestResponse(
  quest: Quest & { creator?: { displayName: string | null } },
) {
  return {
    id: quest.id,
    title: quest.title,
    category: quest.category,
    rewardAmount: quest.rewardAmount.toString(),
    totalSlots: quest.totalSlots,
    filledSlots: quest.filledSlots,
    slotsLeft: Math.max(0, quest.totalSlots - quest.filledSlots),
    promoted: quest.promoted,
    proofType: quest.proofType,
    viewCount: quest.viewCount,
    creatorName: quest.creator?.displayName ?? null,
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
    startAt: quest.startAt?.toISOString() ?? null,
    scheduled: quest.startAt != null && quest.startAt.getTime() > Date.now(),
    promoted: quest.promoted,
    proofType: quest.proofType,
    proofInstructions: quest.proofInstructions,
    sampleEvidence: quest.sampleEvidence ?? null,
    viewCount: quest.viewCount,
    publishedAt: quest.publishedAt?.toISOString() ?? null,
    creatorName: quest.creator?.displayName ?? null,
  };
}
