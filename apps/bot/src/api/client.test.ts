import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client.js";

describe("createApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("upserts a user via POST /api/users/upsert", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "uuid-1",
            telegramId: "123",
            telegramUsername: "worker",
            displayName: "Worker",
            role: "WORKER",
            status: "PENDING",
            reputationScore: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            wallet: null,
          },
        }),
        { status: 200 },
      ),
    );

    const client = createApiClient("http://localhost:3001");
    const user = await client.upsertUser({
      telegramId: "123",
      telegramUsername: "worker",
      displayName: "Worker",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/users/upsert",
      expect.objectContaining({ method: "POST" }),
    );
    expect(user.telegramId).toBe("123");
  });

  it("returns null when user is not found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 404 }));

    const client = createApiClient("http://localhost:3001");
    const user = await client.getUserByTelegramId("missing");

    expect(user).toBeNull();
  });

  it("throws on unexpected API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));

    const client = createApiClient("http://localhost:3001");

    await expect(client.getUserByTelegramId("123")).rejects.toThrow(
      "Failed to look up profile (500)",
    );
  });
});
