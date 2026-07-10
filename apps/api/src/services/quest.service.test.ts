import { describe, expect, it, vi } from "vitest";
import { createQuestService } from "./quest.service.js";

describe("createQuestService", () => {
  it("creates a draft quest for a creator", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "CREATOR",
      status: "ACTIVE",
      walletProfiles: [{ status: "VERIFIED" }],
    });
    const create = vi.fn().mockResolvedValue({
      id: "quest-1",
      title: "Test Quest",
      status: "DRAFT",
    });

    const service = createQuestService({
      user: { findUnique },
      quest: { create, findMany: vi.fn() },
    } as never);

    const quest = await service.createDraftQuest("123", {
      title: "Test Quest",
      category: "FEEDBACK",
      description: "Help us test the new onboarding flow.",
      rewardAmount: 10,
      totalSlots: 5,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      proofType: "TEXT",
      proofInstructions: "Send a short summary of your experience.",
    });

    expect(create).toHaveBeenCalled();
    expect(quest.status).toBe("DRAFT");
  });

  it("rejects non-creators", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "WORKER",
      status: "ACTIVE",
    });

    const service = createQuestService({
      user: { findUnique },
      quest: { create: vi.fn(), findMany: vi.fn() },
    } as never);

    await expect(
      service.createDraftQuest("123", {
        title: "Test Quest",
        category: "FEEDBACK",
        description: "Help us test the new onboarding flow.",
        rewardAmount: 10,
        totalSlots: 5,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        proofType: "TEXT",
        proofInstructions: "Send a short summary of your experience.",
      }),
    ).rejects.toMatchObject({ code: "NOT_CREATOR" });
  });

  it("publishes a draft quest owned by the creator", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "CREATOR",
      status: "ACTIVE",
      walletProfiles: [{ status: "VERIFIED" }],
    });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "user-1",
      status: "DRAFT",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const update = vi.fn().mockResolvedValue({
      id: "quest-1",
      status: "PUBLISHED",
      publishedAt: new Date(),
    });

    const service = createQuestService({
      user: { findUnique },
      quest: { create: vi.fn(), findMany: vi.fn(), findFirst, update },
    } as never);

    const quest = await service.publishQuest("123", "quest-1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "quest-1" },
      data: expect.objectContaining({ status: "PUBLISHED" }),
    });
    expect(quest.status).toBe("PUBLISHED");
  });

  it("rejects publishing a quest that is not a draft", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "CREATOR",
      status: "ACTIVE",
      walletProfiles: [{ status: "VERIFIED" }],
    });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "user-1",
      status: "PUBLISHED",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const service = createQuestService({
      user: { findUnique },
      quest: { create: vi.fn(), findMany: vi.fn(), findFirst, update: vi.fn() },
    } as never);

    await expect(service.publishQuest("123", "quest-1")).rejects.toMatchObject({
      code: "INVALID_STATUS",
    });
  });

  it("blocks a creator from doing their own quest", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "user-1", telegramId: "123" });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "user-1", // same as the submitting user
      status: "PUBLISHED",
      totalSlots: 5,
      filledSlots: 0,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const transaction = vi.fn();

    const service = createQuestService({
      user: { findUnique },
      quest: { findFirst },
      $transaction: transaction,
    } as never);

    await expect(service.submitQuest("123", "quest-1", "my proof")).rejects.toMatchObject({
      code: "CREATOR_CANNOT_SUBMIT",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("records a submission and fills a slot for a worker", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "worker-9", telegramId: "999" });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "user-1",
      status: "PUBLISHED",
      totalSlots: 5,
      filledSlots: 1,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const submissionCreate = vi.fn().mockResolvedValue({ id: "sub-1" });
    const questUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const eventCreate = vi.fn().mockResolvedValue({ id: "ev-1" });
    const transaction = vi.fn(async (fn) =>
      fn({
        questSubmission: { create: submissionCreate },
        quest: { updateMany: questUpdateMany },
        questEvent: { create: eventCreate },
      }),
    );

    const service = createQuestService({
      user: { findUnique },
      quest: { findFirst },
      $transaction: transaction,
    } as never);

    await service.submitQuest("999", "quest-1", "  here is my proof  ");

    expect(submissionCreate).toHaveBeenCalledWith({
      data: { questId: "quest-1", userId: "worker-9", proof: "here is my proof", status: "ACCEPTED" },
    });
    expect(questUpdateMany).toHaveBeenCalledWith({
      where: { id: "quest-1", filledSlots: { lt: 5 } },
      data: { filledSlots: { increment: 1 } },
    });
    expect(eventCreate).toHaveBeenCalledWith({ data: { questId: "quest-1", type: "FILL" } });
  });

  it("rejects an empty proof", async () => {
    const service = createQuestService({
      user: { findUnique: vi.fn() },
      quest: { findFirst: vi.fn() },
    } as never);

    await expect(service.submitQuest("999", "quest-1", "   ")).rejects.toMatchObject({
      code: "INVALID_PROOF",
    });
  });
});
