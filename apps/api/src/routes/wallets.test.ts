import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";

const VALID_ADDRESS = "NQ48 VAXG JD1K YSCM X6H6 DJSL AYN7 FTYF 0KAH";

const { findUnique, findFirst, create, updateMany, transaction } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@nimiqearn/database", () => ({
  prisma: {
    user: { findUnique, upsert: vi.fn(), updateMany },
    walletProfile: { findFirst, create },
    walletAddressAudit: { create: vi.fn() },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: transaction,
  },
}));

describe("wallet routes", () => {
  beforeEach(() => {
    process.env.DATABASE_URL ??=
      "postgresql://nimiqearn:nimiqearn@localhost:5432/nimiqearn";
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "development";
    process.env.PORT = "3099";
    process.env.LOG_LEVEL = "error";
    findUnique.mockReset();
    findFirst.mockReset();
    create.mockReset();
    updateMany.mockReset();
    transaction.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("PUT /api/users/:telegramId/wallet links a wallet", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      telegramId: "123456",
      status: "PENDING",
      walletProfile: null,
    });
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({
      id: "wallet-1",
      userId: "user-1",
      nimiqAddress: VALID_ADDRESS.replace(/\s+/g, ""),
      status: "VERIFIED",
      linkedAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    updateMany.mockResolvedValue({ count: 1 });
    transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        walletProfile: { create },
        user: { updateMany },
      }),
    );

    const { app } = await buildServer();
    const response = await app.inject({
      method: "PUT",
      url: "/api/users/123456/wallet",
      payload: { nimiqAddress: VALID_ADDRESS },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().wallet.status).toBe("VERIFIED");
    await app.close();
  });

  it("PUT /api/users/:telegramId/wallet rejects invalid address", async () => {
    const { app } = await buildServer();
    const response = await app.inject({
      method: "PUT",
      url: "/api/users/123456/wallet",
      payload: { nimiqAddress: "not-valid" },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
