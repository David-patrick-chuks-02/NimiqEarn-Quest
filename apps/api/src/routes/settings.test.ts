import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@nimiqearn/database", () => ({
  prisma: {
    user: { findUnique, update, updateMany: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

describe("settings security-password routes", () => {
  beforeEach(() => {
    process.env.DATABASE_URL ??= "postgresql://nimiqearn:nimiqearn@localhost:5432/nimiqearn";
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "development";
    process.env.PORT = "3098";
    process.env.LOG_LEVEL = "error";
    findUnique.mockReset();
    update.mockReset();
  });

  it("POST sets a new password when none exists", async () => {
    findUnique.mockResolvedValue({ id: "user-1", securityPasswordHash: null });
    update.mockResolvedValue({});

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/users/123456/security/password",
      payload: { password: "hunter22" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(update).toHaveBeenCalledOnce();
    await app.close();
  });

  it("POST rejects a password shorter than the minimum", async () => {
    findUnique.mockResolvedValue({ id: "user-1", securityPasswordHash: null });

    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/users/123456/security/password",
      payload: { password: "no" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("WEAK_PASSWORD");
    await app.close();
  });
});
