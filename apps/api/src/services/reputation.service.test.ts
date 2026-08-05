import { describe, expect, it, vi } from "vitest";
import { createReputationService } from "./reputation.service.js";

describe("createReputationService", () => {
  it("increments on AUTO_APPROVE and CREATOR_ACCEPT", async () => {
    const update = vi.fn().mockResolvedValue({});
    const svc = createReputationService({ user: { update } } as never);

    await svc.applyOutcome("u1", "AUTO_APPROVE");
    await svc.applyOutcome("u1", "CREATOR_ACCEPT");

    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { reputationScore: { increment: 2 } },
    });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("decrements on REJECT", async () => {
    const update = vi.fn().mockResolvedValue({});
    const svc = createReputationService({ user: { update } } as never);

    await svc.applyOutcome("u1", "REJECT");
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { reputationScore: { increment: -3 } },
    });
  });

  it("no-ops for review outcomes", async () => {
    const update = vi.fn().mockResolvedValue({});
    const svc = createReputationService({ user: { update } } as never);

    await svc.applyOutcome("u1", "LIGHT_REVIEW");
    await svc.applyOutcome("u1", "MANUAL_REVIEW");
    expect(update).not.toHaveBeenCalled();
  });
});
