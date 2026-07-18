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

const { getRpcBlockNumber, buildBasicTransaction, sendRawTransaction } = vi.hoisted(() => ({
  getRpcBlockNumber: vi.fn(),
  buildBasicTransaction: vi.fn(),
  sendRawTransaction: vi.fn(),
}));

vi.mock("@nimiqearn/nimiq", () => ({
  getRpcBlockNumber,
  buildBasicTransaction,
  sendRawTransaction,
  networkIdFor: vi.fn().mockReturnValue(1),
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
  });

  afterEach(() => {
    vi.clearAllMocks();
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
    expect(response.json()).toEqual({ ok: true, hash: "mock-tx-hash" });

    expect(buildBasicTransaction).toHaveBeenCalledWith({
      privateKeyHex: "dummy-private-key",
      recipient: "NQ00 TEST ADDRESS",
      valueLuna: 500n * 100000n,
      validityStartHeight: 12345,
      networkId: 1,
    });

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
