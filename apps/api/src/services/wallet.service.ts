import { randomBytes } from "node:crypto";
import type { PrismaClient, WalletProfile } from "@nimiqearn/database";
import { buildVerificationMessage, recoverAddressFromSignedMessage } from "@nimiqearn/nimiq";

const CHALLENGE_TTL_MS = 15 * 60 * 1000;

// Primary wallet first, then most recently linked.
const WALLET_ORDER_BY = [{ isPrimary: "desc" as const }, { linkedAt: "desc" as const }];

export class WalletServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "USER_NOT_FOUND"
      | "INVALID_ADDRESS"
      | "ADDRESS_IN_USE"
      | "ALREADY_LINKED"
      | "SUSPENDED"
      | "CHALLENGE_NOT_FOUND"
      | "CHALLENGE_EXPIRED"
      | "INVALID_SIGNATURE"
      | "WALLET_NOT_FOUND",
  ) {
    super(message);
    this.name = "WalletServiceError";
  }
}

export interface WalletChallenge {
  token: string;
  message: string;
  expiresAt: Date;
}

export function createWalletService(db: PrismaClient, now: () => Date = () => new Date()) {
  return {
    async getWalletsByTelegramId(telegramId: string): Promise<WalletProfile[] | null> {
      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfiles: { orderBy: WALLET_ORDER_BY } },
      });
      return user ? user.walletProfiles : null;
    },

    /**
     * Step 1 — create a verification challenge. The user signs it with whichever wallet
     * they choose; the address is derived from the signature in step 2 (no address entry).
     */
    async startVerification(telegramId: string): Promise<WalletChallenge> {
      const user = await db.user.findUnique({ where: { telegramId } });
      if (!user) {
        throw new WalletServiceError("User not found.", "USER_NOT_FOUND");
      }
      if (user.status === "SUSPENDED") {
        throw new WalletServiceError("Account is suspended.", "SUSPENDED");
      }

      const token = randomBytes(24).toString("hex");
      const message = buildVerificationMessage();
      const expiresAt = new Date(now().getTime() + CHALLENGE_TTL_MS);

      await db.walletVerificationChallenge.upsert({
        where: { userId: user.id },
        create: { userId: user.id, token, message, expiresAt },
        update: { token, message, expiresAt },
      });

      return { token, message, expiresAt };
    },

    /** Returns the challenge details a signing page needs, or null if missing/expired. */
    async getChallengeByToken(token: string) {
      const challenge = await db.walletVerificationChallenge.findUnique({ where: { token } });
      if (!challenge || challenge.expiresAt <= now()) {
        return null;
      }
      return { message: challenge.message };
    },

    /**
     * Step 2 — verify the signed challenge and link the wallet. The first wallet a user
     * links becomes their primary payout wallet; later ones are added as secondary.
     */
    async confirmVerification(
      token: string,
      proof: { publicKey: string; signature: string },
    ): Promise<WalletProfile> {
      const challenge = await db.walletVerificationChallenge.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!challenge) {
        throw new WalletServiceError("Verification challenge not found.", "CHALLENGE_NOT_FOUND");
      }
      if (challenge.expiresAt <= now()) {
        await db.walletVerificationChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
        throw new WalletServiceError("Verification challenge expired.", "CHALLENGE_EXPIRED");
      }
      if (challenge.user.status === "SUSPENDED") {
        throw new WalletServiceError("Account is suspended.", "SUSPENDED");
      }

      // Derive the wallet address from the signature — this is the address the user chose.
      const address = recoverAddressFromSignedMessage({
        message: challenge.message,
        publicKey: proof.publicKey,
        signature: proof.signature,
      });
      if (!address) {
        throw new WalletServiceError("Signature could not be verified.", "INVALID_SIGNATURE");
      }

      const userId = challenge.userId;
      const normalized = address;

      const existing = await db.walletProfile.findUnique({ where: { nimiqAddress: normalized } });
      if (existing) {
        if (existing.userId === userId) {
          throw new WalletServiceError(
            "This wallet is already linked to your account.",
            "ALREADY_LINKED",
          );
        }
        throw new WalletServiceError(
          "This Nimiq address is already linked to another account.",
          "ADDRESS_IN_USE",
        );
      }

      try {
        return await db.$transaction(async (tx) => {
          // Consume the challenge FIRST. Concurrent confirms on the same token serialize on
          // this row delete; only one sees count === 1, so no double-link / double-primary.
          const consumed = await tx.walletVerificationChallenge.deleteMany({
            where: { id: challenge.id },
          });
          if (consumed.count === 0) {
            throw new WalletServiceError(
              "Verification challenge not found.",
              "CHALLENGE_NOT_FOUND",
            );
          }

          const existingCount = await tx.walletProfile.count({ where: { userId } });

          const wallet = await tx.walletProfile.create({
            data: {
              userId,
              nimiqAddress: normalized,
              status: "VERIFIED",
              isPrimary: existingCount === 0, // first wallet is primary
            },
          });

          await tx.walletAddressAudit.create({
            data: { userId, oldAddress: null, newAddress: normalized },
          });

          await tx.user.updateMany({
            where: { id: userId, status: "PENDING" },
            data: { status: "ACTIVE" },
          });

          return wallet;
        });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
          throw new WalletServiceError(
            "This Nimiq address is already linked to another account.",
            "ADDRESS_IN_USE",
          );
        }
        throw error;
      }
    },

    async setPrimaryWallet(telegramId: string, walletId: string): Promise<WalletProfile[]> {
      const user = await db.user.findUnique({ where: { telegramId } });
      if (!user) {
        throw new WalletServiceError("User not found.", "USER_NOT_FOUND");
      }
      if (user.status === "SUSPENDED") {
        throw new WalletServiceError("Account is suspended.", "SUSPENDED");
      }

      const wallet = await db.walletProfile.findFirst({
        where: { id: walletId, userId: user.id },
      });
      if (!wallet) {
        throw new WalletServiceError("Wallet not found.", "WALLET_NOT_FOUND");
      }

      await db.$transaction(async (tx) => {
        await tx.walletProfile.updateMany({
          where: { userId: user.id, isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.walletProfile.update({
          where: { id: wallet.id },
          data: { isPrimary: true },
        });
      });

      return db.walletProfile.findMany({ where: { userId: user.id }, orderBy: WALLET_ORDER_BY });
    },

    async unlinkWallet(telegramId: string, walletId: string): Promise<WalletProfile[]> {
      const user = await db.user.findUnique({ where: { telegramId } });
      if (!user) {
        throw new WalletServiceError("User not found.", "USER_NOT_FOUND");
      }
      if (user.status === "SUSPENDED") {
        throw new WalletServiceError("Account is suspended.", "SUSPENDED");
      }

      const wallet = await db.walletProfile.findFirst({
        where: { id: walletId, userId: user.id },
      });
      if (!wallet) {
        throw new WalletServiceError("Wallet not found.", "WALLET_NOT_FOUND");
      }

      await db.$transaction(async (tx) => {
        await tx.walletProfile.delete({ where: { id: wallet.id } });
        await tx.walletAddressAudit.create({
          data: { userId: user.id, oldAddress: wallet.nimiqAddress, newAddress: null },
        });

        // If the primary was removed, promote the next most-recently linked wallet.
        if (wallet.isPrimary) {
          const next = await tx.walletProfile.findFirst({
            where: { userId: user.id },
            orderBy: { linkedAt: "desc" },
          });
          if (next) {
            await tx.walletProfile.update({ where: { id: next.id }, data: { isPrimary: true } });
          }
        }
      });

      return db.walletProfile.findMany({ where: { userId: user.id }, orderBy: WALLET_ORDER_BY });
    },
  };
}

export type WalletService = ReturnType<typeof createWalletService>;

export function toWalletResponse(wallet: WalletProfile) {
  return {
    nimiqAddress: wallet.nimiqAddress,
    status: wallet.status,
    isPrimary: wallet.isPrimary,
    linkedAt: wallet.linkedAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

export function toWalletListItem(wallet: WalletProfile) {
  return {
    id: wallet.id,
    nimiqAddress: wallet.nimiqAddress,
    status: wallet.status,
    isPrimary: wallet.isPrimary,
    linkedAt: wallet.linkedAt.toISOString(),
  };
}
