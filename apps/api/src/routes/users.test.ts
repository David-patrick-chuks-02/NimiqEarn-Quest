import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";

const { upsert, findUnique } = vi.hoisted(() => ({
  upsert: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@nimiqearn/database", () => ({
  prisma: {
    user: { upsert, findUnique },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

describe("user routes", () => {
  beforeEach(() => {
    process.env.DATABASE_URL ??=
      "postgresql://nimiqearn:nimiqearn@localhost:5432/nimiqearn";
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "development";
    process.env.PORT = "3099";
    process.env.LOG_LEVEL = "error";
    upsert.mockReset();
    findUnique.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/users/upsert creates or updates a user", async () => {
    upsert.mockResolvedValue({
      id: "uuid-1",
      telegramId: "123456",
      telegramUsername: "testuser",
      displayName: "Test User",
      role: "WORKER",
      status: "PENDING",
      reputationScore: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/users/upsert",
      payload: {
        telegramId: "123456",
        displayName: "Test User",
        telegramUsername: "testuser",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        telegramId: "123456",
        displayName: "Test User",
        role: "WORKER",
      },
    });
    await app.close();
  });

  it("POST /api/users/upsert rejects invalid body", async () => {
    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/users/upsert",
      payload: { displayName: "Missing telegram id" },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("GET /api/users/:telegramId returns a user", async () => {
    findUnique.mockResolvedValue({
      id: "uuid-1",
      telegramId: "123456",
      telegramUsername: "testuser",
      displayName: "Test User",
      role: "WORKER",
      status: "PENDING",
      reputationScore: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/users/123456",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.telegramId).toBe("123456");
    await app.close();
  });

  it("GET /api/users/:telegramId returns 404 when missing", async () => {
    findUnique.mockResolvedValue(null);

    const { app } = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/users/unknown",
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
