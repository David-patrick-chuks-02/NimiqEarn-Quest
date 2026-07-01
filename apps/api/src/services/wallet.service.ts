import { randomBytes } from "node:crypto";
import type { PrismaClient, WalletProfile } from "@nimiqearn/database";
import {
  buildVerificationMessage,
  validateNimiqAddress,
  verifyNimiqSignedMessage,
} from "@nimiqearn/nimiq";

const CHALLENGE_TTL_MS = 15 * 60 * 1000;

export class WalletServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "USER_NOT_FOUND"
      | "INVALID_ADDRESS"
      | "ADDRESS_IN_USE"
      | "SUSPENDED"
      | "CHALLENGE_NOT_FOUND"
      | "CHALLENGE_EXPIRED"
      | "INVALID_SIGNATURE",
  ) {
    super(message);
    this.name = "WalletServiceError";
  }
}

export interface WalletChallenge {
  token: string;
  address: string;
  code: string;
  message: string;
  expiresAt: Date;
}

export function createWalletService(db: PrismaClient, now: () => Date = () => new Date()) {
  async function assertAddressAvailable(normalized: string, userId: string) {
    const taken = await db.walletProfile.findFirst({
      where: { nimiqAddress: normalized, userId: { not: userId } },
    });
    if (taken) {
      throw new WalletServiceError(
        "This Nimiq address is already linked to another account.",
        "ADDRESS_IN_USE",
      );
    }
  }

  return {
    async getWalletByTelegramId(telegramId: string): Promise<WalletProfile | null> {
      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfile: true },
      });
      return user?.walletProfile ?? null;
    },

    /**
     * Step 1 — create a verification challenge the user must sign with their wallet.
     * Nothing is marked verified here; ownership is only proven in step 2.
     */
    async startVerification(telegramId: string, nimiqAddress: string): Promise<WalletChallenge> {
      const validation = validateNimiqAddress(nimiqAddress);
      if (!validation.valid || !validation.normalized) {
        throw new WalletServiceError(
          validation.error ?? "Invalid Nimiq address.",
          "INVALID_ADDRESS",
        );
      }

      const user = await db.user.findUnique({ where: { telegramId } });
      if (!user) {
        throw new WalletServiceError("User not found.", "USER_NOT_FOUND");
      }
      if (user.status === "SUSPENDED") {
        throw new WalletServiceError("Account is suspended.", "SUSPENDED");
      }

      const normalized = validation.normalized;
      await assertAddressAvailable(normalized, user.id);

      const token = randomBytes(24).toString("hex");
      const code = randomBytes(3).toString("hex").toUpperCase();
      const message = buildVerificationMessage(normalized, code);
      const expiresAt = new Date(now().getTime() + CHALLENGE_TTL_MS);

      await db.walletVerificationChallenge.upsert({
        where: { userId: user.id },
        create: { userId: user.id, token, nimiqAddress: normalized, message, expiresAt },
        update: { token, nimiqAddress: normalized, message, expiresAt },
      });

      return { token, address: normalized, code, message, expiresAt };
    },

    /** Returns the challenge details a signing page needs, or null if missing/expired. */
    async getChallengeByToken(token: string) {
      const challenge = await db.walletVerificationChallenge.findUnique({ where: { token } });
      if (!challenge || challenge.expiresAt <= now()) {
        return null;
      }
      return { address: challenge.nimiqAddress, message: challenge.message };
    },

    /**
     * Step 2 — verify the signed challenge and, only on success, link + verify the wallet.
     */
    async confirmVerification(
      token: string,
      proof: { publicKey: string; signature: string },
    ): Promise<WalletProfile> {
      const challenge = await db.walletVerificationChallenge.findUnique({
        where: { token },
        include: { user: { include: { walletProfile: true } } },
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

      const valid = verifyNimiqSignedMessage({
        address: challenge.nimiqAddress,
        message: challenge.message,
        publicKey: proof.publicKey,
        signature: proof.signature,
      });
      if (!valid) {
        throw new WalletServiceError("Signature did not match this wallet.", "INVALID_SIGNATURE");
      }

      const userId = challenge.userId;
      const normalized = challenge.nimiqAddress;
      const existing = challenge.user.walletProfile;
      await assertAddressAvailable(normalized, userId);

      try {
        return await db.$transaction(async (tx) => {
          if (!existing || existing.nimiqAddress !== normalized) {
            await tx.walletAddressAudit.create({
              data: {
                userId,
                oldAddress: existing?.nimiqAddress ?? null,
                newAddress: normalized,
              },
            });
          }

          const wallet = await tx.walletProfile.upsert({
            where: { userId },
            create: { userId, nimiqAddress: normalized, status: "VERIFIED" },
            update: { nimiqAddress: normalized, status: "VERIFIED" },
          });

          await tx.user.updateMany({
            where: { id: userId, status: "PENDING" },
            data: { status: "ACTIVE" },
          });

          await tx.walletVerificationChallenge.delete({ where: { id: challenge.id } });

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
