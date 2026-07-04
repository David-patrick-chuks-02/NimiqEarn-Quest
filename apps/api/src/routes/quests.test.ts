import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";

const { findUnique, create, findFirst, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@nimiqearn/database", () => ({
  prisma: {
    user: { findUnique, upsert: vi.fn() },
    quest: { create, findMany: vi.fn(), findFirst, update },
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
    findFirst.mockReset();
    update.mockReset();
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
      walletProfiles: [{ status: "VERIFIED" }],
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

  it("POST /api/users/:telegramId/quests/:questId/publish publishes a draft", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      telegramId: "123456",
      role: "CREATOR",
      status: "ACTIVE",
      walletProfiles: [{ status: "VERIFIED" }],
    });
    findFirst.mockResolvedValue({
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
    update.mockResolvedValue({
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
      status: "PUBLISHED",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: new Date("2026-06-27T00:00:00.000Z"),
    });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/users/123456/quests/quest-1/publish",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().quest.status).toBe("PUBLISHED");
    await app.close();
  });
});
