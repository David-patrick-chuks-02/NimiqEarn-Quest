import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";

const { findUnique, create } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@nimiqearn/database", () => ({
  prisma: {
    user: { findUnique, upsert: vi.fn() },
    quest: { create, findMany: vi.fn() },
    walletProfile: { findFirst: vi.fn(), create: vi.fn() },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

describe("quest routes", () => {
  beforeEach(() => {
    process.env.DATABASE_URL ??=
      "postgresql://nimiqearn:nimiqearn@localhost:5432/nimiqearn";
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "development";
    process.env.PORT = "3099";
    process.env.LOG_LEVEL = "error";
    findUnique.mockReset();
    create.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/users/:telegramId/quests creates a draft quest", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      telegramId: "123456",
      role: "CREATOR",
      status: "ACTIVE",
    });
    create.mockResolvedValue({
      id: "quest-1",
      creatorId: "user-1",
      title: "Community Feedback",
      category: "FEEDBACK",
      description: "Share feedback on the latest Nimiq wallet UX.",
      rewardAmount: "10",
      totalSlots: 5,
      filledSlots: 0,
      deadline: new Date("2026-12-31T00:00:00.000Z"),
      proofType: "TEXT",
      proofInstructions: "Send a short paragraph.",
      status: "DRAFT",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: null,
    });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/users/123456/quests",
      payload: {
        title: "Community Feedback",
        category: "FEEDBACK",
        description: "Share feedback on the latest Nimiq wallet UX.",
        rewardAmount: 10,
        totalSlots: 5,
        deadline: "2026-12-31T00:00:00.000Z",
        proofType: "TEXT",
        proofInstructions: "Send a short paragraph.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().quest.status).toBe("DRAFT");
    await app.close();
  });
});
