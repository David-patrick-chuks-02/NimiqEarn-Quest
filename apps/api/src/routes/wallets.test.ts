import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";

const VALID_ADDRESS = "NQ48 VAXG JD1K YSCM X6H6 DJSL AYN7 FTYF 0KAH";

const { userFindUnique, walletFindFirst, challengeUpsert } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  walletFindFirst: vi.fn(),
  challengeUpsert: vi.fn(),
}));

vi.mock("@nimiqearn/database", () => ({
  prisma: {
    user: { findUnique: userFindUnique, upsert: vi.fn(), updateMany: vi.fn() },
    walletProfile: { findFirst: walletFindFirst, findUnique: vi.fn() },
    walletAddressAudit: { create: vi.fn() },
    walletVerificationChallenge: { upsert: challengeUpsert, findUnique: vi.fn() },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

describe("wallet routes", () => {
  beforeEach(() => {
    process.env.DATABASE_URL ??= "postgresql://nimiqearn:nimiqearn@localhost:5432/nimiqearn";
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "development";
    process.env.PORT = "3099";
    process.env.LOG_LEVEL = "error";
    userFindUnique.mockReset();
    walletFindFirst.mockReset();
    challengeUpsert.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("POST /wallet/challenge creates a signing challenge", async () => {
    userFindUnique.mockResolvedValue({ id: "user-1", telegramId: "123456", status: "PENDING" });
    walletFindFirst.mockResolvedValue(null);
    challengeUpsert.mockResolvedValue({});

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/users/123456/wallet/challenge",
      payload: { nimiqAddress: VALID_ADDRESS },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.challenge.token).toBeTruthy();
    expect(body.challenge.message).toContain(body.challenge.code);
    await app.close();
  });

  it("POST /wallet/challenge rejects an invalid address", async () => {
    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/users/123456/wallet/challenge",
      payload: { nimiqAddress: "not-valid" },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
