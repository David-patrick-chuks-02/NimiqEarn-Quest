import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";

const { findUnique, verifyInitDataMock } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  verifyInitDataMock: vi.fn(),
}));

vi.mock("@nimiqearn/database", () => ({
  prisma: {
    user: { findUnique },
    quest: { findMany: vi.fn(), update: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

vi.mock("../telegram-auth.js", () => ({
  verifyInitData: verifyInitDataMock,
}));

const {
  getRpcBlockNumber,
  buildBasicTransaction,
  sendRawTransaction,
  fetchNimiqAccount,
} = vi.hoisted(() => ({
  getRpcBlockNumber: vi.fn(),
  buildBasicTransaction: vi.fn(),
  sendRawTransaction: vi.fn(),
  fetchNimiqAccount: vi.fn(),
}));

vi.mock("@nimiqearn/nimiq", () => ({
  getRpcBlockNumber,
  buildBasicTransaction,
  sendRawTransaction,
  fetchNimiqAccount,
  networkIdFor: vi.fn().mockReturnValue(1),
}));

const { getNimUsdPrice } = vi.hoisted(() => ({
  getNimUsdPrice: vi.fn(),
}));

vi.mock("../services/price.js", () => ({
  getNimUsdPrice,
}));

describe("studio routes", () => {
  beforeEach(() => {
    process.env.DATABASE_URL ??= "postgresql://nimiqearn:nimiqearn@localhost:5432/nimiqearn";
    process.env.NODE_ENV = "test";
    process.env.PORT = "3099";
    process.env.LOG_LEVEL = "error";
    process.env.NIMIQ_NETWORK = "testnet";
    process.env.FAUCET_ADMIN_PRIVATE_KEY = "dummy-private-key";
    process.env.BOT_TOKEN = "dummy-bot-token";

    findUnique.mockReset();
    verifyInitDataMock.mockReset();
    getRpcBlockNumber.mockReset();
    buildBasicTransaction.mockReset();
    sendRawTransaction.mockReset();
    fetchNimiqAccount.mockReset();
    getNimUsdPrice.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/studio/faucet returns quote with USD values", async () => {
    verifyInitDataMock.mockReturnValue({ telegramId: "test-user-123" });
    findUnique.mockResolvedValue({
      id: "user-1",
      telegramId: "test-user-123",
      walletProfiles: [
        {
          keyCiphertext: "mock-cipher",
          nimiqAddress: "NQ00 TEST ADDRESS",
        },
      ],
    });
    fetchNimiqAccount.mockResolvedValue({
      reachable: true,
      balanceLuna: 0,
      balanceNim: 0,
    });
    getNimUsdPrice.mockResolvedValue(0.001);

    const { app } = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/studio/faucet",
      headers: { "x-telegram-init-data": "mock-init-data" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      dripNim: 500,
      maxUsd: 1000,
      amountNim: 500,
      amountUsd: 0.5,
      balanceNim: 0,
      balanceUsd: 0,
      canRequest: true,
      capped: false,
    });
    await app.close();
  });

  it("POST /api/studio/faucet dispenses NIM to creator wallet", async () => {
    verifyInitDataMock.mockReturnValue({ telegramId: "test-user-123" });

    findUnique.mockResolvedValue({
      id: "user-1",
      telegramId: "test-user-123",
      walletProfiles: [
        {
          keyCiphertext: "mock-cipher",
          nimiqAddress: "NQ00 TEST ADDRESS",
        },
      ],
    });

    fetchNimiqAccount.mockResolvedValue({
      reachable: true,
      balanceLuna: 0,
      balanceNim: 0,
    });
    getNimUsdPrice.mockResolvedValue(0.001);
    getRpcBlockNumber.mockResolvedValue(12345);
    buildBasicTransaction.mockReturnValue({ hex: "mock-tx-hex" });
    sendRawTransaction.mockResolvedValue({ hash: "mock-tx-hash" });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/studio/faucet",
      headers: {
        "x-telegram-init-data": "mock-init-data",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      hash: "mock-tx-hash",
      amountNim: 500,
      amountUsd: 0.5,
    });

    expect(buildBasicTransaction).toHaveBeenCalledWith({
      privateKeyHex: "dummy-private-key",
      recipient: "NQ00 TEST ADDRESS",
      valueLuna: 500n * 100000n,
      validityStartHeight: 12345,
      networkId: 1,
    });

    await app.close();
  });

  it("POST /api/studio/faucet rejects wallets at the $1000 USD cap", async () => {
    verifyInitDataMock.mockReturnValue({ telegramId: "test-user-123" });
    findUnique.mockResolvedValue({
      id: "user-1",
      telegramId: "test-user-123",
      walletProfiles: [
        {
          keyCiphertext: "mock-cipher",
          nimiqAddress: "NQ00 TEST ADDRESS",
        },
      ],
    });
    // $1000 at $0.001/NIM = 1_000_000 NIM
    fetchNimiqAccount.mockResolvedValue({
      reachable: true,
      balanceLuna: 1_000_000 * 100_000,
      balanceNim: 1_000_000,
    });
    getNimUsdPrice.mockResolvedValue(0.001);

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/studio/faucet",
      headers: { "x-telegram-init-data": "mock-init-data" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/faucet cap/i);
    expect(buildBasicTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/studio/faucet fails if not on testnet", async () => {
    process.env.NIMIQ_NETWORK = "mainnet";
    verifyInitDataMock.mockReturnValue({ telegramId: "test-user-123" });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/studio/faucet",
      headers: {
        "x-telegram-init-data": "mock-init-data",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Faucet is only available on testnet." });
    await app.close();
  });
});
