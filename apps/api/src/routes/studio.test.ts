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

describe("studio routes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.DATABASE_URL ??= "postgresql://nimiqearn:nimiqearn@localhost:5432/nimiqearn";
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "development";
    process.env.PORT = "3099";
    process.env.LOG_LEVEL = "error";
    process.env.NIMIQ_NETWORK = "testnet";
    process.env.FAUCET_ADMIN_PRIVATE_KEY = "dummy-private-key";
    process.env.BOT_TOKEN = "dummy-bot-token";
    delete process.env.API_SHARED_SECRET;

    findUnique.mockReset();
    verifyInitDataMock.mockReset();
    getRpcBlockNumber.mockReset();
    buildBasicTransaction.mockReset();
    sendRawTransaction.mockReset();
    fetchNimiqAccount.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("GET /api/studio/faucet returns quote with NIM cap values", async () => {
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

    const { app } = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/studio/faucet?amountNim=1000",
      headers: { "x-telegram-init-data": "mock-init-data" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      presets: [100, 500, 1000, 5000, 10_000],
      maxNim: 1_000_000,
      amountNim: 1000,
      requestedNim: 1000,
      balanceNim: 0,
      remainingNim: 1_000_000,
      canRequest: true,
      capped: false,
    });
    await app.close();
  });

  it("POST /api/studio/faucet dispenses requested NIM to creator wallet", async () => {
    verifyInitDataMock.mockReturnValue({ telegramId: "test-user-123" });

    findUnique.mockResolvedValue({
      id: "user-1",
      telegramId: "test-user-123",
      telegramHubMessageId: null,
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
    getRpcBlockNumber.mockResolvedValue(12345);
    buildBasicTransaction.mockReturnValue({ hex: "mock-tx-hex" });
    sendRawTransaction.mockResolvedValue({ hash: "mock-tx-hash" });
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/studio/faucet",
      headers: {
        "x-telegram-init-data": "mock-init-data",
        "content-type": "application/json",
      },
      payload: { amountNim: 1000 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      hash: "mock-tx-hash",
      amountNim: 1000,
      balanceBeforeNim: 0,
      balanceAfterNim: 1000,
    });

    expect(buildBasicTransaction).toHaveBeenCalledWith({
      privateKeyHex: "dummy-private-key",
      recipient: "NQ00 TEST ADDRESS",
      valueLuna: 1000n * 100000n,
      validityStartHeight: 12345,
      networkId: 1,
    });

    // No saved hub message → fallback notify (sendMessage), not edit.
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/sendMessage");

    await app.close();
  });

  it("POST /api/studio/faucet edits the saved Creator Hub message when present", async () => {
    verifyInitDataMock.mockReturnValue({ telegramId: "test-user-123" });

    findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        telegramId: "test-user-123",
        telegramHubMessageId: 168,
        role: "CREATOR",
        status: "ACTIVE",
        displayName: "David",
        walletProfiles: [
          {
            keyCiphertext: "mock-cipher",
            nimiqAddress: "NQ00 TEST ADDRESS",
          },
        ],
      })
      // creators.getDashboard()
      .mockResolvedValueOnce({
        id: "user-1",
        telegramId: "test-user-123",
        displayName: "David",
        role: "CREATOR",
        status: "ACTIVE",
        quests: [{ status: "DRAFT" }, { status: "PUBLISHED" }],
      });

    fetchNimiqAccount.mockResolvedValue({
      reachable: true,
      balanceLuna: 0,
      balanceNim: 0,
    });
    getRpcBlockNumber.mockResolvedValue(12345);
    buildBasicTransaction.mockReturnValue({ hex: "mock-tx-hex" });
    sendRawTransaction.mockResolvedValue({ hash: "mock-tx-hash" });
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/studio/faucet",
      headers: {
        "x-telegram-init-data": "mock-init-data",
        "content-type": "application/json",
      },
      payload: { amountNim: 500 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      amountNim: 500,
      balanceAfterNim: 500,
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain("/editMessageText");
    const body = JSON.parse(String((init as { body?: string })?.body ?? "{}")) as {
      chat_id: string;
      message_id: number;
      text: string;
    };
    expect(body).toMatchObject({ chat_id: "test-user-123", message_id: 168 });
    expect(body.text).toContain("*Balance:* 500 NIM");
    expect(body.text).toContain("*Creator Hub*");

    await app.close();
  });

  it("POST /api/studio/faucet rejects wallets at the 1M NIM cap", async () => {
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
      balanceLuna: 1_000_000 * 100_000,
      balanceNim: 1_000_000,
    });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/studio/faucet",
      headers: {
        "x-telegram-init-data": "mock-init-data",
        "content-type": "application/json",
      },
      payload: { amountNim: 500 },
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
