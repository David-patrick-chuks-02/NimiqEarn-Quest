import { describe, expect, it, vi } from "vitest";
import { createCreatorService, CreatorServiceError } from "./creator.service.js";

describe("createCreatorService", () => {
  it("promotes a worker to creator", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "WORKER",
      status: "PENDING",
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
      data: { role: "CREATOR", status: "ACTIVE" },
    });
    expect(user.role).toBe("CREATOR");
  });

  it("returns existing creators without updating", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "CREATOR",
      status: "ACTIVE",
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
    });

    const service = createCreatorService({
      user: { findUnique },
    } as never);

    await expect(service.registerCreator("123")).rejects.toMatchObject({
      code: "SUSPENDED",
    } satisfies Partial<CreatorServiceError>);
  });
});
