import type { PrismaClient, QuestStatus, User } from "@nimiqearn/database";
import { createProfileService, ProfileServiceError } from "./profile.service.js";

export class CreatorServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "USER_NOT_FOUND"
      | "SUSPENDED"
      | "ALREADY_CREATOR"
      | "NOT_CREATOR"
      | "NOT_VERIFIED",
  ) {
    super(message);
    this.name = "CreatorServiceError";
  }
}

function isCreatorRole(role: string) {
  return role === "CREATOR" || role === "ADMIN";
}

export function createCreatorService(db: PrismaClient) {
  const profiles = createProfileService(db);

  return {
    async registerCreator(telegramId: string): Promise<User> {
      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfile: true },
      });

      if (!user) {
        throw new CreatorServiceError("User not found.", "USER_NOT_FOUND");
      }

      if (user.status === "SUSPENDED") {
        throw new CreatorServiceError(
          "This account is suspended and cannot become a creator.",
          "SUSPENDED",
        );
      }

      if (isCreatorRole(user.role)) {
        return user;
      }

      try {
        profiles.assertVerifiedProfile(user);
      } catch (error) {
        if (error instanceof ProfileServiceError) {
          throw new CreatorServiceError(error.message, error.code);
        }
        throw error;
      }

      return db.user.update({
        where: { telegramId },
        data: { role: "CREATOR" },
      });
    },

    async getDashboard(telegramId: string) {
      const user = await db.user.findUnique({
        where: { telegramId },
        include: {
          quests: {
            select: { status: true },
          },
        },
      });

      if (!user) {
        throw new CreatorServiceError("User not found.", "USER_NOT_FOUND");
      }

      if (!isCreatorRole(user.role)) {
        throw new CreatorServiceError("Creator access required.", "NOT_CREATOR");
      }

      const counts = countQuestsByStatus(user.quests.map((quest) => quest.status));

      return {
        user: {
          id: user.id,
          telegramId: user.telegramId,
          displayName: user.displayName,
          role: user.role,
          status: user.status,
        },
        quests: counts,
      };
    },
  };
}

export type CreatorService = ReturnType<typeof createCreatorService>;

function countQuestsByStatus(statuses: QuestStatus[]) {
  return statuses.reduce(
    (acc, status) => {
      acc[status] = (acc[status] ?? 0) + 1;
      acc.total += 1;
      return acc;
    },
    {
      total: 0,
      DRAFT: 0,
      PUBLISHED: 0,
      CLOSED: 0,
      ARCHIVED: 0,
    },
  );
}
