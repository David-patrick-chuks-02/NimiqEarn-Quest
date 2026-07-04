import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";

const { userFindUnique, challengeUpsert } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  challengeUpsert: vi.fn(),
}));

vi.mock("@nimiqearn/database", () => ({
  prisma: {
    user: { findUnique: userFindUnique, upsert: vi.fn(), updateMany: vi.fn() },
    walletProfile: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
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
    challengeUpsert.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("POST /wallet/challenge creates an address-less signing challenge", async () => {
    userFindUnique.mockResolvedValue({ id: "user-1", telegramId: "123456", status: "PENDING" });
    challengeUpsert.mockResolvedValue({});

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/users/123456/wallet/challenge",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.challenge.token).toBeTruthy();
    expect(body.challenge.message).toContain(body.challenge.code);
    expect(body.challenge.address).toBeUndefined();
    await app.close();
  });

  it("POST /wallet/challenge returns 404 for an unknown user", async () => {
    userFindUnique.mockResolvedValue(null);

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/users/999/wallet/challenge",
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
