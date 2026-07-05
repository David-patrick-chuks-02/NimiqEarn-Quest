import { describe, expect, it, vi } from "vitest";
import { buildVerificationMessage, signMessageWithRandomKey } from "@nimiqearn/nimiq";
import { createWalletService, WalletServiceError } from "./wallet.service.js";

const FIXED_NOW = new Date("2026-06-30T00:00:00.000Z");

/** A stored (address-less) challenge + a valid proof; the signer's address is derived on confirm. */
function buildSignedChallenge() {
  const message = buildVerificationMessage();
  const signed = signMessageWithRandomKey(message);
  return { address: signed.address, message, publicKey: signed.publicKey, signature: signed.signature };
}

function challengeRow(message: string) {
  return {
    id: "ch-1",
    userId: "user-1",
    token: "tok",
    message,
    expiresAt: new Date(FIXED_NOW.getTime() + 60_000),
    user: { id: "user-1", status: "PENDING" },
  };
}

describe("wallet verification service", () => {
  it("creates an address-less challenge to sign", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "user-1", status: "PENDING" });
    const upsert = vi.fn().mockResolvedValue({});

    const service = createWalletService(
      { user: { findUnique }, walletVerificationChallenge: { upsert } } as never,
      () => FIXED_NOW,
    );

    const challenge = await service.startVerification("123");

    expect(challenge.token).toHaveLength(48);
    expect(challenge.message).toContain("Link this wallet");
    expect(upsert).toHaveBeenCalled();
  });

  it("rejects starting verification for a missing user", async () => {
    const service = createWalletService(
      { user: { findUnique: vi.fn().mockResolvedValue(null) } } as never,
      () => FIXED_NOW,
    );
    await expect(service.startVerification("123")).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
    } satisfies Partial<WalletServiceError>);
  });

  it("derives the address from the signature and links the first wallet as primary", async () => {
    const signed = buildSignedChallenge();

    const count = vi.fn().mockResolvedValue(0); // no existing wallets → primary
    const create = vi.fn().mockResolvedValue({
      id: "wallet-1",
      userId: "user-1",
      nimiqAddress: signed.address,
      status: "VERIFIED",
      isPrimary: true,
      linkedAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    const auditCreate = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const challengeDeleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const service = createWalletService(
      {
        walletVerificationChallenge: { findUnique: vi.fn().mockResolvedValue(challengeRow(signed.message)) },
        walletProfile: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({
            walletProfile: { count, create },
            walletAddressAudit: { create: auditCreate },
            user: { updateMany },
            walletVerificationChallenge: { deleteMany: challengeDeleteMany },
          }),
        ),
      } as never,
      () => FIXED_NOW,
    );

    const wallet = await service.confirmVerification("tok", {
      publicKey: signed.publicKey,
      signature: signed.signature,
    });

    expect(wallet.nimiqAddress).toBe(signed.address);
    expect(wallet.isPrimary).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nimiqAddress: signed.address, isPrimary: true }),
      }),
    );
    expect(challengeDeleteMany).toHaveBeenCalled();
  });

  it("rejects when the derived address is already linked to another account", async () => {
    const signed = buildSignedChallenge();
    const service = createWalletService(
      {
        walletVerificationChallenge: { findUnique: vi.fn().mockResolvedValue(challengeRow(signed.message)) },
        walletProfile: { findUnique: vi.fn().mockResolvedValue({ id: "w-x", userId: "user-2" }) },
      } as never,
      () => FIXED_NOW,
    );

    await expect(
      service.confirmVerification("tok", { publicKey: signed.publicKey, signature: signed.signature }),
    ).rejects.toMatchObject({ code: "ADDRESS_IN_USE" } satisfies Partial<WalletServiceError>);
  });

  it("rejects re-linking an address the same user already owns", async () => {
    const signed = buildSignedChallenge();
    const service = createWalletService(
      {
        walletVerificationChallenge: { findUnique: vi.fn().mockResolvedValue(challengeRow(signed.message)) },
        walletProfile: { findUnique: vi.fn().mockResolvedValue({ id: "w-1", userId: "user-1" }) },
      } as never,
      () => FIXED_NOW,
    );

    await expect(
      service.confirmVerification("tok", { publicKey: signed.publicKey, signature: signed.signature }),
    ).rejects.toMatchObject({ code: "ALREADY_LINKED" } satisfies Partial<WalletServiceError>);
  });

  it("rejects a signature that does not match the challenge message", async () => {
    const signed = buildSignedChallenge();
    // `other` signed a different message, so it can't be recovered against the challenge.
    const other = signMessageWithRandomKey("some other message");

    const service = createWalletService(
      {
        walletVerificationChallenge: {
          findUnique: vi.fn().mockResolvedValue(challengeRow(signed.message)),
        },
      } as never,
      () => FIXED_NOW,
    );

    await expect(
      service.confirmVerification("tok", {
        publicKey: other.publicKey,
        signature: other.signature,
      }),
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" } satisfies Partial<WalletServiceError>);
  });

  it("maps a unique-constraint race (P2002) to ADDRESS_IN_USE", async () => {
    const signed = buildSignedChallenge();
    const service = createWalletService(
      {
        walletVerificationChallenge: { findUnique: vi.fn().mockResolvedValue(challengeRow(signed.message)) },
        walletProfile: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(async () => {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }),
      } as never,
      () => FIXED_NOW,
    );

    await expect(
      service.confirmVerification("tok", { publicKey: signed.publicKey, signature: signed.signature }),
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
            message: "m",
            expiresAt: new Date(FIXED_NOW.getTime() - 1),
            user: { id: "user-1", status: "PENDING" },
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

describe("wallet management", () => {
  it("sets a wallet as primary and returns the updated list", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "user-1" });
    const findFirst = vi.fn().mockResolvedValue({ id: "w-2", userId: "user-1", isPrimary: false });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({});
    const findMany = vi.fn().mockResolvedValue([
      { id: "w-2", isPrimary: true },
      { id: "w-1", isPrimary: false },
    ]);

    const service = createWalletService(
      {
        user: { findUnique },
        walletProfile: { findFirst, updateMany, update, findMany },
        $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({ walletProfile: { updateMany, update } }),
        ),
      } as never,
      () => FIXED_NOW,
    );

    const list = await service.setPrimaryWallet("123", "w-2");
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isPrimary: true },
      data: { isPrimary: false },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: "w-2" }, data: { isPrimary: true } });
    expect(list[0]!.id).toBe("w-2");
  });

  it("rejects setting primary on a wallet the user does not own", async () => {
    const service = createWalletService(
      {
        user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
        walletProfile: { findFirst: vi.fn().mockResolvedValue(null) },
      } as never,
      () => FIXED_NOW,
    );

    await expect(service.setPrimaryWallet("123", "w-x")).rejects.toMatchObject({
      code: "WALLET_NOT_FOUND",
    } satisfies Partial<WalletServiceError>);
  });

  it("unlinks a wallet and promotes another when the primary is removed", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "user-1" });
    const findFirstOuter = vi
      .fn()
      .mockResolvedValue({ id: "w-1", userId: "user-1", isPrimary: true, nimiqAddress: "NQ..A" });
    const del = vi.fn().mockResolvedValue({});
    const auditCreate = vi.fn().mockResolvedValue({});
    const findFirstNext = vi.fn().mockResolvedValue({ id: "w-2" });
    const update = vi.fn().mockResolvedValue({});
    const findMany = vi.fn().mockResolvedValue([{ id: "w-2", isPrimary: true }]);

    const service = createWalletService(
      {
        user: { findUnique },
        walletProfile: { findFirst: findFirstOuter, findMany },
        $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({
            walletProfile: { delete: del, findFirst: findFirstNext, update },
            walletAddressAudit: { create: auditCreate },
          }),
        ),
      } as never,
      () => FIXED_NOW,
    );

    const list = await service.unlinkWallet("123", "w-1");
    expect(del).toHaveBeenCalledWith({ where: { id: "w-1" } });
    expect(auditCreate).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ where: { id: "w-2" }, data: { isPrimary: true } });
    expect(list[0]!.id).toBe("w-2");
  });
});
