import { describe, expect, it, vi, afterEach } from "vitest";
import { createVerificationService } from "./verification.service.js";

function mockDb(overrides: Record<string, unknown> = {}) {
  return {
    questSubmission: {
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      ...(overrides.questSubmission as object),
    },
    moderationEvent: {
      create: vi.fn().mockResolvedValue({}),
      ...(overrides.moderationEvent as object),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      ...(overrides.user as object),
    },
    walletProfile: {
      count: vi.fn().mockResolvedValue(0),
      ...(overrides.walletProfile as object),
    },
    referralEdge: {
      count: vi.fn().mockResolvedValue(0),
      upsert: vi.fn().mockResolvedValue({}),
      ...(overrides.referralEdge as object),
    },
  } as never;
}

describe("createVerificationService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fail-closes to MANUAL_REVIEW when verifier URL is unset", async () => {
    const update = vi.fn().mockResolvedValue({});
    const moderationCreate = vi.fn().mockResolvedValue({});
    const db = mockDb({
      questSubmission: { update, findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      moderationEvent: { create: moderationCreate },
    });
    const svc = createVerificationService(db, {});

    const result = await svc.verifySubmission({
      submissionId: "sub-1",
      userId: "u-1",
      workerTelegramId: "111",
      proofType: "TEXT",
      proof: "Detailed feedback about the product experience.",
      proofInstructions: "Write product feedback",
      title: "Feedback",
      reputationScore: 0,
    });

    expect(result.decision.outcome).toBe("MANUAL_REVIEW");
    expect(result.moderationQueue).toBe("PLATFORM");
    expect(result.aiResult).toBeNull();
    expect(update).toHaveBeenCalled();
    expect(moderationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resolution: "MANUAL_REVIEW" }),
      }),
    );
  });

  it("AUTO_APPROVE when verifier returns high confidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          confidence: 0.95,
          signals: { spamScore: 0.1 },
          recommendation: "approve",
        }),
      }),
    );

    const db = mockDb();
    const svc = createVerificationService(db, {
      url: "http://verifier.test",
      sharedSecret: "s",
    });

    const result = await svc.verifySubmission({
      submissionId: "sub-1",
      userId: "u-1",
      workerTelegramId: "111",
      proofType: "TEXT",
      proof: "Detailed feedback about the product experience and onboarding flow.",
      proofInstructions: "Write product feedback",
      title: "Feedback",
      reputationScore: 10,
    });

    expect(result.decision.outcome).toBe("AUTO_APPROVE");
    expect(result.aiResult?.confidence).toBe(0.95);
  });

  it("REJECT when deterministic rules fail", async () => {
    const db = mockDb();
    const svc = createVerificationService(db, { url: "http://verifier.test" });

    const result = await svc.verifySubmission({
      submissionId: "sub-1",
      userId: "u-1",
      workerTelegramId: "111",
      proofType: "LINK",
      proof: "not-a-url",
      proofInstructions: "Share your post",
      title: "Social",
      reputationScore: 0,
    });

    expect(result.decision.outcome).toBe("REJECT");
    expect(result.ruleResult.passed).toBe(false);
  });
});
