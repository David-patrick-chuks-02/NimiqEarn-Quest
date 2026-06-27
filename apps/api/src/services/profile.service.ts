import type { PrismaClient, User, UserStatus, WalletProfile } from "@nimiqearn/database";

export class ProfileServiceError extends Error {
  constructor(
    message: string,
    readonly code: "USER_NOT_FOUND" | "SUSPENDED" | "NOT_VERIFIED",
  ) {
    super(message);
    this.name = "ProfileServiceError";
  }
}

export function isProfileVerified(user: Pick<User, "status">) {
  return user.status === "ACTIVE";
}

export function hasVerifiedWallet(wallet: Pick<WalletProfile, "status"> | null | undefined) {
  return wallet?.status === "VERIFIED";
}

export function createProfileService(db: PrismaClient) {
  return {
    async activateAfterWalletLink(userId: string) {
      await db.user.updateMany({
        where: { id: userId, status: "PENDING" },
        data: { status: "ACTIVE" },
      });
    },

    assertVerifiedProfile(user: (User & { walletProfile?: WalletProfile | null }) | null) {
      if (!user) {
        throw new ProfileServiceError("User not found.", "USER_NOT_FOUND");
      }
      if (user.status === "SUSPENDED") {
        throw new ProfileServiceError("Account is suspended.", "SUSPENDED");
      }
      if (!isProfileVerified(user) || !hasVerifiedWallet(user.walletProfile)) {
        throw new ProfileServiceError(
          "Profile verification required. Link a Nimiq wallet first.",
          "NOT_VERIFIED",
        );
      }
    },

    verificationStatus(user: User & { walletProfile?: WalletProfile | null }) {
      const walletLinked = Boolean(user.walletProfile);
      const walletVerified = hasVerifiedWallet(user.walletProfile);
      const profileVerified = isProfileVerified(user);

      return {
        profileStatus: user.status as UserStatus,
        walletLinked,
        walletVerified,
        profileVerified,
        stepsComplete: Number(walletVerified) + Number(profileVerified),
        stepsTotal: 2,
      };
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
