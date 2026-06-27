import { describe, expect, it, vi } from "vitest";
import { createCreatorService, CreatorServiceError } from "./creator.service.js";

describe("createCreatorService", () => {
  it("promotes a verified worker to creator", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "WORKER",
      status: "ACTIVE",
      walletProfile: { status: "VERIFIED" },
    });
    const update = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "CREATOR",
      status: "ACTIVE",
    });

    const service = createCreatorService({
      user: { findUnique, update },
    } as never);

    const user = await service.registerCreator("123");

    expect(update).toHaveBeenCalledWith({
      where: { telegramId: "123" },
      data: { role: "CREATOR" },
    });
    expect(user.role).toBe("CREATOR");
  });

  it("rejects unverified workers", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "WORKER",
      status: "PENDING",
      walletProfile: null,
    });

    const service = createCreatorService({
      user: { findUnique, update: vi.fn() },
    } as never);

    await expect(service.registerCreator("123")).rejects.toMatchObject({
      code: "NOT_VERIFIED",
    } satisfies Partial<CreatorServiceError>);
  });

  it("returns existing creators without updating", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "CREATOR",
      status: "ACTIVE",
      walletProfile: { status: "VERIFIED" },
    });
    const update = vi.fn();

    const service = createCreatorService({
      user: { findUnique, update },
    } as never);

    const user = await service.registerCreator("123");

    expect(update).not.toHaveBeenCalled();
    expect(user.role).toBe("CREATOR");
  });

  it("rejects suspended users", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "WORKER",
      status: "SUSPENDED",
      walletProfile: null,
    });

    const service = createCreatorService({
      user: { findUnique },
    } as never);

    await expect(service.registerCreator("123")).rejects.toMatchObject({
      code: "SUSPENDED",
    } satisfies Partial<CreatorServiceError>);
  });
});
