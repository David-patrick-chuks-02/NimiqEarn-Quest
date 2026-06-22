import { describe, expect, it } from "vitest";
import { formatWorkerStatus } from "./worker-status.js";

describe("formatWorkerStatus", () => {
  it("formats a pending worker profile", () => {
    const text = formatWorkerStatus({
      id: "uuid-1",
      telegramId: "123",
      telegramUsername: "worker",
      displayName: "Test Worker",
      role: "WORKER",
      status: "PENDING",
      reputationScore: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(text).toContain("Test Worker's worker status");
    expect(text).toContain("Pending verification");
    expect(text).toContain("Wallet: not linked yet");
    expect(text).toContain("Available quests: none yet");
  });
});
