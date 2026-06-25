import type { PrismaClient, User, WalletProfile } from "@nimiqearn/database";
import type { CreateUserInput } from "@nimiqearn/shared";
import { toWalletResponse } from "./wallet.service.js";

export function createUserService(db: PrismaClient) {
  return {
    upsertUser(input: CreateUserInput): Promise<User> {
      return db.user.upsert({
        where: { telegramId: input.telegramId },
        create: {
          telegramId: input.telegramId,
          telegramUsername: input.telegramUsername,
          displayName: input.displayName,
          role: input.role ?? "WORKER",
        },
        update: {
          telegramUsername: input.telegramUsername,
          displayName: input.displayName,
        },
      });
    },

    findByTelegramId(telegramId: string) {
      return db.user.findUnique({
        where: { telegramId },
        include: { walletProfile: true },
      });
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;

export function toUserResponse(user: User & { walletProfile?: WalletProfile | null }) {
  return {
    id: user.id,
    telegramId: user.telegramId,
    telegramUsername: user.telegramUsername,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    reputationScore: user.reputationScore,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    wallet: user.walletProfile ? toWalletResponse(user.walletProfile) : null,
  };
}
