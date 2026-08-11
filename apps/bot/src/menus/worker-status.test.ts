import { describe, expect, it } from "vitest";
import { formatWorkerStatus } from "./worker-status.js";

describe("formatWorkerStatus", () => {
  it("formats an unverified worker profile without wallet", () => {
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
      wallets: [],
    });

    expect(text).toContain("Your profile");
    expect(text).toContain("Not set up");
    expect(text).toContain("Start Earning");
  });

  it("formats a verified worker with a linked wallet", () => {
    const text = formatWorkerStatus({
      id: "uuid-1",
      telegramId: "123",
      telegramUsername: "worker",
      displayName: "Test Worker",
      role: "WORKER",
      status: "ACTIVE",
      reputationScore: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      wallet: {
        nimiqAddress: "NQ48VAXGJD1KYSCMX6H6DJSLAYN7FTYF0KAH",
        status: "VERIFIED",
        isPrimary: true,
        linkedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      wallets: [
        {
          id: "wallet-1",
          nimiqAddress: "NQ48VAXGJD1KYSCMX6H6DJSLAYN7FTYF0KAH",
          status: "VERIFIED",
          isPrimary: true,
          linkedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(text).toContain("Your profile");
    expect(text).toContain("Wallet · Ready");
    expect(text).toContain("browse open quests by category");
  });
});
