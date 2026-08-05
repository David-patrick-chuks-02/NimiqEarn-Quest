import { describe, expect, it, vi } from "vitest";
import { createReputationService } from "./reputation.service.js";

function mockDb(update = vi.fn().mockResolvedValue({}), create = vi.fn().mockResolvedValue({})) {
  return {
    user: {
      update,
      findUnique: vi.fn().mockResolvedValue({
        reputationScore: 10,
        reputationDecayedAt: new Date(),
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        reputationScore: 10,
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      }),
    },
    questSubmission: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ createdAt: new Date() }),
    },
    reputationEvent: {
      create,
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  } as never;
}

describe("createReputationService", () => {
  it("increments on AUTO_APPROVE and CREATOR_ACCEPT", async () => {
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    const svc = createReputationService(mockDb(update, create));

    await svc.applyOutcome("u1", "AUTO_APPROVE");
    await svc.applyOutcome("u1", "CREATOR_ACCEPT");

    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { reputationScore: { increment: 2 } },
    });
    expect(create).toHaveBeenCalled();
  });

  it("decrements on REJECT and logs an event", async () => {
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    const svc = createReputationService(mockDb(update, create));

    await svc.applyOutcome("u1", "REJECT", { questCategory: "FEEDBACK" });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { reputationScore: { increment: -3 } },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "REJECT", delta: -3, category: "FEEDBACK" }),
      }),
    );
  });

  it("no-ops for review outcomes", async () => {
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    const svc = createReputationService(mockDb(update, create));

    await svc.applyOutcome("u1", "LIGHT_REVIEW");
    await svc.applyOutcome("u1", "MANUAL_REVIEW");
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("records fraud violations with larger penalties", async () => {
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    const svc = createReputationService(mockDb(update, create));
    await svc.recordViolation("u1", "DUP", { submissionId: "s1" });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { reputationScore: { increment: -5 } },
    });
  });
});
