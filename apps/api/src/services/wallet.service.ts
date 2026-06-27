import type { PrismaClient, WalletProfile } from "@nimiqearn/database";
import { validateNimiqAddress } from "@nimiqearn/nimiq";

export class WalletServiceError extends Error {
  constructor(
    message: string,
    readonly code: "USER_NOT_FOUND" | "INVALID_ADDRESS" | "ADDRESS_IN_USE" | "SUSPENDED",
  ) {
    super(message);
    this.name = "WalletServiceError";
  }
}

export function createWalletService(db: PrismaClient) {
  return {
    async getWalletByTelegramId(telegramId: string): Promise<WalletProfile | null> {
      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfile: true },
      });
      return user?.walletProfile ?? null;
    },

    async linkWallet(telegramId: string, nimiqAddress: string): Promise<WalletProfile> {
      const validation = validateNimiqAddress(nimiqAddress);
      if (!validation.valid || !validation.normalized) {
        throw new WalletServiceError(validation.error ?? "Invalid Nimiq address.", "INVALID_ADDRESS");
      }

      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfile: true },
      });

      if (!user) {
        throw new WalletServiceError("User not found.", "USER_NOT_FOUND");
      }

      if (user.status === "SUSPENDED") {
        throw new WalletServiceError("Account is suspended.", "SUSPENDED");
      }

      const normalized = validation.normalized;

      const taken = await db.walletProfile.findFirst({
        where: {
          nimiqAddress: normalized,
          userId: { not: user.id },
        },
      });

      if (taken) {
        throw new WalletServiceError(
          "This Nimiq address is already linked to another account.",
          "ADDRESS_IN_USE",
        );
      }

      if (user.walletProfile) {
        const oldAddress = user.walletProfile.nimiqAddress;
        if (oldAddress === normalized) {
          return user.walletProfile;
        }

        return db.$transaction(async (tx) => {
          await tx.walletAddressAudit.create({
            data: {
              userId: user.id,
              oldAddress,
              newAddress: normalized,
            },
          });

          const wallet = await tx.walletProfile.update({
            where: { userId: user.id },
            data: {
              nimiqAddress: normalized,
              status: "VERIFIED",
            },
          });

          await tx.user.updateMany({
            where: { id: user.id, status: "PENDING" },
            data: { status: "ACTIVE" },
          });

          return wallet;
        });
      }

      return db.$transaction(async (tx) => {
        const wallet = await tx.walletProfile.create({
          data: {
            userId: user.id,
            nimiqAddress: normalized,
            status: "VERIFIED",
          },
        });

        await tx.user.updateMany({
          where: { id: user.id, status: "PENDING" },
          data: { status: "ACTIVE" },
        });

        return wallet;
      });
    },
  };
}

export type WalletService = ReturnType<typeof createWalletService>;

export function toWalletResponse(wallet: WalletProfile) {
  return {
    nimiqAddress: wallet.nimiqAddress,
    status: wallet.status,
    linkedAt: wallet.linkedAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
  };
}
