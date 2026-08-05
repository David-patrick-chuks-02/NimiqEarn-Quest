import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@nimiqearn/database";

export class SecurityServiceError extends Error {
  constructor(
    message: string,
    readonly code: "USER_NOT_FOUND" | "WRONG_PASSWORD" | "NO_PASSWORD" | "WEAK_PASSWORD",
  ) {
    super(message);
    this.name = "SecurityServiceError";
  }
}

const MIN_LENGTH = 8;

// Stored as "salt:hash" (both hex). scrypt is deliberately slow to resist brute force.
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyHash(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Optional per-user "secure action password" gating sensitive actions (withdrawals). */
export function createSecurityService(db: PrismaClient) {
  async function loadUser(telegramId: string) {
    const user = await db.user.findUnique({
      where: { telegramId },
      select: { id: true, securityPasswordHash: true },
    });
    if (!user) throw new SecurityServiceError("User not found.", "USER_NOT_FOUND");
    return user;
  }

  return {
    async status(telegramId: string): Promise<{ passwordSet: boolean }> {
      const user = await loadUser(telegramId);
      return { passwordSet: user.securityPasswordHash !== null };
    },

    /** Set or change the password. Changing requires the current password. */
    async setPassword(telegramId: string, newPassword: string, currentPassword?: string) {
      if (newPassword.length < MIN_LENGTH) {
        throw new SecurityServiceError(
          `Password must be at least ${MIN_LENGTH} characters.`,
          "WEAK_PASSWORD",
        );
      }
      const user = await loadUser(telegramId);
      if (user.securityPasswordHash) {
        if (!currentPassword || !verifyHash(currentPassword, user.securityPasswordHash)) {
          throw new SecurityServiceError("Current password is incorrect.", "WRONG_PASSWORD");
        }
      }
      await db.user.update({
        where: { id: user.id },
        data: { securityPasswordHash: hashPassword(newPassword) },
      });
    },

    async clearPassword(telegramId: string, currentPassword: string) {
      const user = await loadUser(telegramId);
      if (!user.securityPasswordHash) {
        throw new SecurityServiceError("No password is set.", "NO_PASSWORD");
      }
      if (!verifyHash(currentPassword, user.securityPasswordHash)) {
        throw new SecurityServiceError("Password is incorrect.", "WRONG_PASSWORD");
      }
      await db.user.update({ where: { id: user.id }, data: { securityPasswordHash: null } });
    },

    /** True if the action may proceed: no password set, or the provided one matches. */
    async verify(telegramId: string, password: string | undefined): Promise<boolean> {
      const user = await db.user.findUnique({
        where: { telegramId },
        select: { securityPasswordHash: true },
      });
      if (!user?.securityPasswordHash) return true;
      return password !== undefined && verifyHash(password, user.securityPasswordHash);
    },
  };
}

export type SecurityService = ReturnType<typeof createSecurityService>;
