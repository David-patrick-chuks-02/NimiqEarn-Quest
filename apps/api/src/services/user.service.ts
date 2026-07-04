import type { PrismaClient, User, WalletProfile } from "@nimiqearn/database";
import type { CreateUserInput } from "@nimiqearn/shared";
import { toWalletListItem, toWalletResponse } from "./wallet.service.js";

// Primary wallet first, then most recently linked.
export const walletOrderBy = [{ isPrimary: "desc" as const }, { linkedAt: "desc" as const }];

export function createUserService(db: PrismaClient) {
  return {
    upsertUser(input: CreateUserInput): Promise<User> {
      return db.user.upsert({
        where: { telegramId: input.telegramId },
        create: {
          telegramId: input.telegramId,
          telegramUsername: input.telegramUsername,
          displayName: input.displayName,
          // role is not client-settable; DB defaults new users to WORKER.
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
        include: { walletProfiles: { orderBy: walletOrderBy } },
      });
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;

export function toUserResponse(user: User & { walletProfiles?: WalletProfile[] }) {
  const wallets = user.walletProfiles ?? [];
  // Backward-compatible `wallet` = the primary (or first) wallet.
  const primary = wallets.find((w) => w.isPrimary) ?? wallets[0] ?? null;

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
    wallet: primary ? toWalletResponse(primary) : null,
    wallets: wallets.map(toWalletListItem),
  };
}
