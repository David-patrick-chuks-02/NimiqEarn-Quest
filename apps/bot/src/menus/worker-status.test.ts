import { describe, expect, it } from "vitest";
import { formatWorkerStatus } from "./worker-status.js";

describe("formatWorkerStatus", () => {
  it("formats a pending worker profile without wallet", () => {
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
      wallet: null,
    });

    expect(text).toContain("Test Worker's worker status");
    expect(text).toContain("Wallet: not linked");
    expect(text).toContain("/wallet");
  });

  it("formats a worker with a linked wallet", () => {
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
      wallet: {
        nimiqAddress: "NQ48VAXGJD1KYSCMX6H6DJSLAYN7FTYF0KAH",
        status: "VERIFIED",
        linkedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(text).toContain("Wallet: linked (verified)");
  });
});
