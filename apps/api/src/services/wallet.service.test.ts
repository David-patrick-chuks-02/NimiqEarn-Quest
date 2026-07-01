import { describe, expect, it, vi } from "vitest";
import { buildVerificationMessage, signMessageWithRandomKey } from "@nimiqearn/nimiq";
import { createWalletService, WalletServiceError } from "./wallet.service.js";

const FIXED_NOW = new Date("2026-06-30T00:00:00.000Z");

/**
 * Produce a stored challenge + a valid proof for it. The signer's real address is used
 * as the challenge's `nimiqAddress` (that's what verification compares against).
 */
function buildSignedChallenge() {
  const message = buildVerificationMessage("NQ00 0000 0000 0000 0000", "ABC123");
  const signed = signMessageWithRandomKey(message);
  return {
    address: signed.address,
    message,
    publicKey: signed.publicKey,
    signature: signed.signature,
  };
}

describe("wallet verification service", () => {
  it("creates a challenge for a valid address", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "user-1", status: "PENDING" });
    const upsert = vi.fn().mockResolvedValue({});

    const service = createWalletService(
      {
        user: { findUnique },
        walletProfile: { findFirst: vi.fn().mockResolvedValue(null) },
        walletVerificationChallenge: { upsert },
      } as never,
      () => FIXED_NOW,
    );

    const challenge = await service.startVerification(
      "123",
      "NQ48 VAXG JD1K YSCM X6H6 DJSL AYN7 FTYF 0KAH",
    );

    expect(challenge.token).toHaveLength(48);
    expect(challenge.message).toContain(challenge.address);
    expect(challenge.message).toContain(challenge.code);
    expect(upsert).toHaveBeenCalled();
  });

  it("rejects invalid addresses", async () => {
    const service = createWalletService({} as never, () => FIXED_NOW);
    await expect(service.startVerification("123", "bad-address")).rejects.toMatchObject({
      code: "INVALID_ADDRESS",
    } satisfies Partial<WalletServiceError>);
  });

  it("verifies a correctly signed challenge and links the wallet", async () => {
    const signed = buildSignedChallenge();

    const challengeRow = {
      id: "ch-1",
      userId: "user-1",
      token: "tok",
      nimiqAddress: signed.address,
      message: signed.message,
      expiresAt: new Date(FIXED_NOW.getTime() + 60_000),
      user: { id: "user-1", status: "PENDING", walletProfile: null },
    };

    const upsertWallet = vi.fn().mockResolvedValue({
      id: "wallet-1",
      userId: "user-1",
      nimiqAddress: signed.address,
      status: "VERIFIED",
      linkedAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    const auditCreate = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const challengeDelete = vi.fn().mockResolvedValue({});

    const service = createWalletService(
      {
        walletProfile: { findFirst: vi.fn().mockResolvedValue(null) },
        walletVerificationChallenge: {
          findUnique: vi.fn().mockResolvedValue(challengeRow),
        },
        $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({
            walletAddressAudit: { create: auditCreate },
            walletProfile: { upsert: upsertWallet },
            user: { updateMany },
            walletVerificationChallenge: { delete: challengeDelete },
          }),
        ),
      } as never,
      () => FIXED_NOW,
    );

    const wallet = await service.confirmVerification("tok", {
      publicKey: signed.publicKey,
      signature: signed.signature,
    });

    expect(wallet.status).toBe("VERIFIED");
    expect(auditCreate).toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", status: "PENDING" },
      data: { status: "ACTIVE" },
    });
    expect(challengeDelete).toHaveBeenCalled();
  });

  it("rejects an invalid signature", async () => {
    const signed = buildSignedChallenge();
    const otherSigner = buildSignedChallenge(); // signature from a different key

    const service = createWalletService(
      {
        walletProfile: { findFirst: vi.fn() },
        walletVerificationChallenge: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ch-1",
            userId: "user-1",
            token: "tok",
            nimiqAddress: signed.address,
            message: signed.message,
            expiresAt: new Date(FIXED_NOW.getTime() + 60_000),
            user: { id: "user-1", status: "PENDING", walletProfile: null },
          }),
        },
      } as never,
      () => FIXED_NOW,
    );

    await expect(
      service.confirmVerification("tok", {
        publicKey: otherSigner.publicKey,
        signature: otherSigner.signature,
      }),
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" } satisfies Partial<WalletServiceError>);
  });

  it("refuses to start verification for an address linked to another account", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "user-1", status: "ACTIVE" });
    const walletFindFirst = vi
      .fn()
      .mockResolvedValue({ id: "wallet-other", userId: "user-2" });

    const service = createWalletService(
      {
        user: { findUnique },
        walletProfile: { findFirst: walletFindFirst },
        walletVerificationChallenge: { upsert: vi.fn() },
      } as never,
      () => FIXED_NOW,
    );

    await expect(
      service.startVerification("123", "NQ48 VAXG JD1K YSCM X6H6 DJSL AYN7 FTYF 0KAH"),
    ).rejects.toMatchObject({ code: "ADDRESS_IN_USE" } satisfies Partial<WalletServiceError>);
    // The pre-check excludes the requesting user via { userId: { not: user.id } }.
    expect(walletFindFirst).toHaveBeenCalledWith({
      where: { nimiqAddress: expect.any(String), userId: { not: "user-1" } },
    });
  });

  it("maps a unique-constraint race (P2002) to ADDRESS_IN_USE on confirm", async () => {
    const signed = buildSignedChallenge();
    const service = createWalletService(
      {
        walletProfile: { findFirst: vi.fn().mockResolvedValue(null) },
        walletVerificationChallenge: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ch-1",
            userId: "user-1",
            token: "tok",
            nimiqAddress: signed.address,
            message: signed.message,
            expiresAt: new Date(FIXED_NOW.getTime() + 60_000),
            user: { id: "user-1", status: "PENDING", walletProfile: null },
          }),
        },
        // Another account claimed the address between the pre-check and the write.
        $transaction: vi.fn(async () => {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }),
      } as never,
      () => FIXED_NOW,
    );

    await expect(
      service.confirmVerification("tok", {
        publicKey: signed.publicKey,
        signature: signed.signature,
      }),
    ).rejects.toMatchObject({ code: "ADDRESS_IN_USE" } satisfies Partial<WalletServiceError>);
  });

  it("rejects an expired challenge", async () => {
    const del = vi.fn().mockResolvedValue({});
    const service = createWalletService(
      {
        walletVerificationChallenge: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ch-1",
            userId: "user-1",
            token: "tok",
            nimiqAddress: "NQ",
            message: "m",
            expiresAt: new Date(FIXED_NOW.getTime() - 1),
            user: { id: "user-1", status: "PENDING", walletProfile: null },
          }),
          delete: del,
        },
      } as never,
      () => FIXED_NOW,
    );

    await expect(
      service.confirmVerification("tok", { publicKey: "ab", signature: "cd" }),
    ).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" } satisfies Partial<WalletServiceError>);
  });
});
