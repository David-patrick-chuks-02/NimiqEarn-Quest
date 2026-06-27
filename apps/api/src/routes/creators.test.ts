import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@nimiqearn/database", () => ({
  prisma: {
    user: { findUnique, update, upsert: vi.fn() },
    walletProfile: { findFirst: vi.fn(), create: vi.fn() },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

describe("creator routes", () => {
  beforeEach(() => {
    process.env.DATABASE_URL ??=
      "postgresql://nimiqearn:nimiqearn@localhost:5432/nimiqearn";
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "development";
    process.env.PORT = "3099";
    process.env.LOG_LEVEL = "error";
    findUnique.mockReset();
    update.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/users/:telegramId/creator/register promotes a worker", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      telegramId: "123456",
      telegramUsername: "worker",
      displayName: "Worker",
      role: "WORKER",
      status: "ACTIVE",
      reputationScore: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      walletProfile: { status: "VERIFIED" },
    });
    update.mockResolvedValue({
      id: "user-1",
      telegramId: "123456",
      telegramUsername: "worker",
      displayName: "Worker",
      role: "CREATOR",
      status: "ACTIVE",
      reputationScore: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/users/123456/creator/register",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.role).toBe("CREATOR");
    await app.close();
  });

  it("GET /api/users/:telegramId/creator/dashboard requires creator role", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      telegramId: "123456",
      displayName: "Worker",
      role: "WORKER",
      status: "PENDING",
      quests: [],
    });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/users/123456/creator/dashboard",
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
