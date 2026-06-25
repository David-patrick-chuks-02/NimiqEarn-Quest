import { describe, expect, it, vi } from "vitest";
import { createWalletService, WalletServiceError } from "./wallet.service.js";

const VALID_ADDRESS = "NQ48 VAXG JD1K YSCM X6H6 DJSL AYN7 FTYF 0KAH";

describe("createWalletService", () => {
  it("links a new wallet for a user", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      walletProfile: null,
    });
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({
      id: "wallet-1",
      userId: "user-1",
      nimiqAddress: VALID_ADDRESS.replace(/\s+/g, ""),
      status: "VERIFIED",
      linkedAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const service = createWalletService({
      user: { findUnique },
      walletProfile: { findFirst, create },
    } as never);

    const wallet = await service.linkWallet("123", VALID_ADDRESS);

    expect(create).toHaveBeenCalled();
    expect(wallet.status).toBe("VERIFIED");
  });

  it("rejects invalid addresses", async () => {
    const service = createWalletService({} as never);

    await expect(service.linkWallet("123", "bad-address")).rejects.toMatchObject({
      code: "INVALID_ADDRESS",
    } satisfies Partial<WalletServiceError>);
  });

  it("rejects when user is missing", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const service = createWalletService({
      user: { findUnique },
    } as never);

    await expect(service.linkWallet("123", VALID_ADDRESS)).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
    } satisfies Partial<WalletServiceError>);
  });
});
