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
      | "NOT_FUNDED",
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

      // A quest with an escrow wallet must be funded with the full reward pool before it
      // goes live — this is where the creator "pays" for the quest.
      let fundedAt: Date | null = null;
      if (escrow?.enabled && quest.escrowAddress) {
        const requiredLuna = escrow.requiredLuna(Number(quest.rewardAmount), quest.totalSlots);
        const funding = await escrow.getFunding(quest.escrowAddress, requiredLuna);
        if (!funding.funded) {
          throw new QuestServiceError(
            "This quest's escrow wallet isn't fully funded yet.",
            "NOT_FUNDED",
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
  };
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
  };
}
