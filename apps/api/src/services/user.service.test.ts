import { describe, expect, it, vi } from "vitest";
import { createUserService } from "./user.service.js";

describe("createUserService", () => {
  it("upserts a user by telegram id", async () => {
    const upsert = vi.fn().mockResolvedValue({
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

    const service = createUserService({ user: { upsert, findUnique: vi.fn() } } as never);
    const user = await service.upsertUser({
      telegramId: "123456",
      telegramUsername: "testuser",
      displayName: "Test User",
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { telegramId: "123456" },
      create: {
        telegramId: "123456",
        telegramUsername: "testuser",
        displayName: "Test User",
      },
      update: {
        telegramUsername: "testuser",
        displayName: "Test User",
      },
    });
    expect(user.telegramId).toBe("123456");
  });

  it("finds a user by telegram id", async () => {
    const findUnique = vi.fn().mockResolvedValue({ telegramId: "999" });
    const service = createUserService({ user: { upsert: vi.fn(), findUnique } } as never);

    const user = await service.findByTelegramId("999");

    expect(findUnique).toHaveBeenCalledWith({
      where: { telegramId: "999" },
      include: { walletProfiles: { orderBy: [{ isPrimary: "desc" }, { linkedAt: "desc" }] } },
    });
    expect(user).toEqual({ telegramId: "999" });
  });
});
