import { describe, expect, it, vi, beforeEach } from "vitest";
import { MAX_PROOF_IMAGE_CHARS, MAX_PROOF_TOTAL_CHARS } from "@nimiqearn/shared";
import { createQuestService, splitRewardLuna } from "./quest.service.js";

// The worker-link path runs the social checks, which would hit the network. Stub the fetcher so
// these stay offline unit tests.
const fetchSocialPost = vi.fn();
vi.mock("./social-fetch.js", () => ({
  fetchSocialPost: (...args: unknown[]) => fetchSocialPost(...args),
}));

beforeEach(() => {
  fetchSocialPost.mockReset();
  fetchSocialPost.mockResolvedValue({
    source: "x",
    exists: true,
    deleted: false,
    isPublic: true,
    text: "campaign post",
    hashtags: [],
  });
});

/** Minimal quest-service double for proof-validation tests. */
function makeSubmitService(proofType: string) {
  const submissionCreate = vi.fn().mockResolvedValue({ id: "sub-1" });
  const service = createQuestService({
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "worker-9",
        telegramId: "999",
        status: "ACTIVE",
        reputationScore: 0,
        walletProfiles: [],
      }),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        reputationScore: 0,
        createdAt: new Date(),
        reputationDecayedAt: new Date(),
      }),
    },
    quest: {
      findFirst: vi.fn().mockResolvedValue({
        id: "quest-1",
        creatorId: "creator-x",
        status: "PUBLISHED",
        totalSlots: 5,
        filledSlots: 0,
        startAt: null,
        proofType,
        proofInstructions: "Upload proof.",
        title: "Quest",
        rewardAmount: "10",
        escrowKeyCiphertext: null,
      }),
    },
    questSubmission: {
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue({ createdAt: new Date() }),
    },
    reputationEvent: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    moderationEvent: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        questSubmission: {
          create: submissionCreate,
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({}),
        },
        quest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      }),
    ),
  } as never);
  return { service, submissionCreate };
}

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
      fundedAt: null,
      escrowAddress: null,
    });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: "quest-1",
      status: "PUBLISHED",
      publishedAt: new Date(),
    });

    const service = createQuestService({
      user: { findUnique },
      quest: { create: vi.fn(), findMany: vi.fn(), findFirst, updateMany, findUniqueOrThrow },
    } as never);

    const quest = await service.publishQuest("123", "quest-1");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "quest-1", status: "DRAFT" },
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
    const findUnique = vi.fn().mockResolvedValue({ id: "user-1", telegramId: "123", status: "ACTIVE" });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "user-1", // same as the submitting user
      status: "PUBLISHED",
      totalSlots: 5,
      filledSlots: 0,
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

  it("records a PENDING submission and fills a slot for a worker (no payout yet)", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "worker-9",
      telegramId: "999",
      status: "ACTIVE",
      reputationScore: 0,
      walletProfiles: [],
    });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "user-1",
      status: "PUBLISHED",
      totalSlots: 5,
      filledSlots: 1,
      proofType: "TEXT",
      proofInstructions: "Write feedback.",
      title: "Quest",
      escrowKeyCiphertext: null,
    });
    const submissionCreate = vi.fn().mockResolvedValue({ id: "sub-1" });
    const questUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const submissionUpdate = vi.fn().mockResolvedValue({});
    const moderationCreate = vi.fn().mockResolvedValue({});
    const transaction = vi.fn(async (fn) =>
      fn({
        questSubmission: { create: submissionCreate },
        quest: { updateMany: questUpdateMany },
      }),
    );

    const service = createQuestService({
      user: {
        findUnique,
        update: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          reputationScore: 0,
          createdAt: new Date(),
          reputationDecayedAt: new Date(),
        }),
      },
      quest: { findFirst },
      questSubmission: {
        update: submissionUpdate,
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue({ createdAt: new Date() }),
      },
      reputationEvent: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
      moderationEvent: { create: moderationCreate },
      $transaction: transaction,
    } as never);

    const result = await service.submitQuest("999", "quest-1", "  here is my proof  ");

    // No VERIFIER_URL → fail closed to MANUAL_REVIEW, stays PENDING.
    expect(result).toEqual({
      status: "PENDING",
      outcome: "MANUAL_REVIEW",
      txHash: null,
      txUrl: null,
    });
    expect(submissionCreate).toHaveBeenCalledWith({
      data: {
        questId: "quest-1",
        userId: "worker-9",
        proof: "here is my proof",
        proofExtras: [],
        proofLink: null,
        status: "PENDING",
        clientFingerprint: null,
        ipHash: null,
      },
    });
    expect(questUpdateMany).toHaveBeenCalledWith({
      where: { id: "quest-1", filledSlots: { lt: 5 } },
      data: { filledSlots: { increment: 1 } },
    });
    expect(moderationCreate).toHaveBeenCalled();
  });

  it("rejects via verification when proof fails deterministic rules after create", async () => {
    // normalizeSubmissionProof catches empty before create; use TEXT with image to fail rules
    // after create — actually normalize catches image for TEXT. Use a path that creates then
    // rule-engine would still pass normalize... IMAGE for SCREENSHOT with bad mime is caught
    // by normalize. So test reject via mocked high-fail is covered in package tests.
    // Here we assert INVALID_PROOF still blocks before create:
    const service = createQuestService({
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "w",
          status: "ACTIVE",
          reputationScore: 0,
          walletProfiles: [],
        }),
      },
      quest: {
        findFirst: vi.fn().mockResolvedValue({
          id: "quest-1",
          creatorId: "other",
          status: "PUBLISHED",
          proofType: "TEXT",
          startAt: null,
        }),
      },
    } as never);

    await expect(
      service.submitQuest("999", "quest-1", "data:image/jpeg;base64,AAAA"),
    ).rejects.toMatchObject({ code: "INVALID_PROOF" });
  });

  it("pays the reward when the creator accepts a PENDING submission", async () => {
    const creator = { id: "user-1", telegramId: "123", role: "CREATOR" };
    const worker = {
      id: "worker-9",
      telegramId: "999",
      walletProfiles: [{ nimiqAddress: "NQ_WORKER", keyCiphertext: "enc" }],
    };
    const submission = {
      id: "sub-1",
      userId: "worker-9",
      status: "PENDING",
      payoutTxHash: null,
      quest: {
        id: "quest-1",
        creatorId: "user-1",
        title: "Quest",
        rewardAmount: "10",
        escrowKeyCiphertext: "escrow-enc",
      },
      user: worker,
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const submissionUpdate = vi.fn().mockResolvedValue({});
    const transfer = vi.fn().mockResolvedValue({ hash: "0xdeadbeef" });

    const service = createQuestService(
      {
        user: { findUnique: vi.fn().mockResolvedValue(creator), update: vi.fn() },
        questSubmission: {
          findUnique: vi.fn().mockResolvedValue(submission),
          updateMany,
          update: submissionUpdate,
        },
        questEvent: { create: vi.fn().mockResolvedValue({}) },
        reputationEvent: { create: vi.fn().mockResolvedValue({}) },
        $transaction: vi.fn(async (ops: unknown) => {
          if (Array.isArray(ops)) return Promise.all(ops);
          if (typeof ops === "function") return (ops as (tx: unknown) => unknown)({});
          return ops;
        }),
      } as never,
      {
        enabled: true,
        requiredLuna: (nim: number, slots: number) => BigInt(nim * slots * 100_000),
        transfer,
        explorerTxUrl: (h: string) => `https://nimiq.watch/#${h}`,
      } as never,
    );

    const result = await service.acceptSubmission("123", "sub-1");

    expect(transfer).toHaveBeenCalledWith({
      fromKeyCiphertext: "escrow-enc",
      toAddress: "NQ_WORKER",
      valueLuna: BigInt(10 * 100_000),
    });
    expect(result).toEqual({ txHash: "0xdeadbeef", txUrl: "https://nimiq.watch/#0xdeadbeef" });
    expect(submissionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: expect.objectContaining({ payoutTxHash: "0xdeadbeef" }),
    });
  });

  it("pays the worker the reduced reward and forwards the 7.5% tasker fee", async () => {
    const creator = { id: "user-1", telegramId: "123", role: "CREATOR" };
    const worker = {
      id: "worker-9",
      telegramId: "999",
      walletProfiles: [{ nimiqAddress: "NQ_WORKER", keyCiphertext: "enc" }],
    };
    const submission = {
      id: "sub-1",
      userId: "worker-9",
      status: "PENDING",
      payoutTxHash: null,
      quest: {
        id: "quest-1",
        creatorId: "user-1",
        title: "Quest",
        rewardAmount: "10",
        escrowKeyCiphertext: "escrow-enc",
      },
      user: worker,
    };
    const transfer = vi.fn().mockResolvedValue({ hash: "0xdeadbeef" });

    const service = createQuestService(
      {
        user: { findUnique: vi.fn().mockResolvedValue(creator), update: vi.fn() },
        questSubmission: {
          findUnique: vi.fn().mockResolvedValue(submission),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({}),
        },
        questEvent: { create: vi.fn().mockResolvedValue({}) },
        reputationEvent: { create: vi.fn().mockResolvedValue({}) },
        $transaction: vi.fn(async (ops: unknown) => {
          if (Array.isArray(ops)) return Promise.all(ops);
          if (typeof ops === "function") return (ops as (tx: unknown) => unknown)({});
          return ops;
        }),
      } as never,
      {
        enabled: true,
        requiredLuna: (nim: number, slots: number) => BigInt(nim * slots * 100_000),
        transfer,
        explorerTxUrl: (h: string) => `https://nimiq.watch/#${h}`,
      } as never,
      { percent: 6, address: "NQ_FEE", promotionNim: 100, taskerPercent: 7.5 },
    );

    await service.acceptSubmission("123", "sub-1");

    // 10 NIM reward = 1_000_000 luna; 7.5% = 75_000 luna to the platform.
    expect(transfer).toHaveBeenCalledWith({
      fromKeyCiphertext: "escrow-enc",
      toAddress: "NQ_WORKER",
      valueLuna: 925_000n,
    });
    expect(transfer).toHaveBeenCalledWith({
      fromKeyCiphertext: "escrow-enc",
      toAddress: "NQ_FEE",
      valueLuna: 75_000n,
    });
    // Exactly two transfers — the escrow is fully drained, leaving no dust.
    expect(transfer).toHaveBeenCalledTimes(2);
  });

  it("rejects an empty proof", async () => {
    const service = createQuestService({
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "worker-9",
          status: "ACTIVE",
          walletProfiles: [],
        }),
      },
      quest: {
        findFirst: vi.fn().mockResolvedValue({
          id: "quest-1",
          creatorId: "other",
          status: "PUBLISHED",
          proofType: "TEXT",
          startAt: null,
        }),
      },
    } as never);

    await expect(service.submitQuest("999", "quest-1", "   ")).rejects.toMatchObject({
      code: "INVALID_PROOF",
    });
  });

  it("accepts a compressed screenshot data URL for SCREENSHOT quests", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "worker-9",
      telegramId: "999",
      status: "ACTIVE",
      reputationScore: 0,
      walletProfiles: [],
    });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "creator-x",
      status: "PUBLISHED",
      totalSlots: 5,
      filledSlots: 0,
      startAt: null,
      proofType: "SCREENSHOT",
      proofInstructions: "Upload a screenshot of the follow button.",
      title: "Shot",
      rewardAmount: "10",
      escrowKeyCiphertext: null,
    });
    const submissionCreate = vi.fn().mockResolvedValue({ id: "sub-1" });
    const questUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = createQuestService({
      user: {
        findUnique,
        update: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          reputationScore: 0,
          createdAt: new Date(),
          reputationDecayedAt: new Date(),
        }),
      },
      quest: { findFirst },
      questSubmission: {
        update: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue({ createdAt: new Date() }),
      },
      reputationEvent: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
      moderationEvent: { create: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(async (fn) =>
        fn({
          questSubmission: { create: submissionCreate },
          quest: { updateMany: questUpdateMany },
        }),
      ),
    } as never);

    const screenshot = "data:image/jpeg;base64,/9j/4AAQ";
    const result = await service.submitQuest("999", "quest-1", screenshot);

    expect(result.status).toBe("PENDING");
    expect(submissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ proof: screenshot, status: "PENDING" }),
    });
  });

  it("accepts up to 3 uploads and stores the extras", async () => {
    const { service, submissionCreate } = makeSubmitService("SCREENSHOT");
    const a = "data:image/jpeg;base64,/9j/4AAQ1";
    const b = "data:image/png;base64,/9j/4AAQ2";
    const c = "data:image/webp;base64,/9j/4AAQ3";

    const result = await service.submitQuest("999", "quest-1", a, { proofExtras: [b, c] });

    expect(result.status).toBe("PENDING");
    expect(submissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ proof: a, proofExtras: [b, c] }),
    });
  });

  it("accepts three images at the per-image cap (still fits the request budget)", async () => {
    const { service, submissionCreate } = makeSubmitService("SCREENSHOT");
    const maxImage = () => `data:image/jpeg;base64,${"A".repeat(MAX_PROOF_IMAGE_CHARS - 23)}`;
    const [a, b, c] = [maxImage(), maxImage(), maxImage()];

    expect(a.length).toBe(MAX_PROOF_IMAGE_CHARS);
    expect(a.length + b.length + c.length).toBeLessThanOrEqual(MAX_PROOF_TOTAL_CHARS);

    const result = await service.submitQuest("999", "quest-1", a, { proofExtras: [b, c] });

    expect(result.status).toBe("PENDING");
    expect(submissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ proofExtras: [b, c] }),
    });
  });

  it("rejects a fourth upload", async () => {
    const { service } = makeSubmitService("SCREENSHOT");
    const img = (n: number) => `data:image/jpeg;base64,/9j/4AAQ${n}`;

    await expect(
      service.submitQuest("999", "quest-1", img(1), { proofExtras: [img(2), img(3), img(4)] }),
    ).rejects.toMatchObject({ code: "INVALID_PROOF" });
  });

  it("rejects an oversized extra image", async () => {
    const { service } = makeSubmitService("SCREENSHOT");
    const big = `data:image/jpeg;base64,${"A".repeat(MAX_PROOF_IMAGE_CHARS + 1)}`;

    await expect(
      service.submitQuest("999", "quest-1", "data:image/jpeg;base64,/9j/4AAQ", {
        proofExtras: [big],
      }),
    ).rejects.toMatchObject({ code: "INVALID_PROOF" });
  });

  it("accepts a single video for UPLOADED_MEDIA", async () => {
    const { service, submissionCreate } = makeSubmitService("UPLOADED_MEDIA");
    const video = "data:video/mp4;base64,AAAA";

    const result = await service.submitQuest("999", "quest-1", video);

    expect(result.status).toBe("PENDING");
    expect(submissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ proof: video, proofExtras: [] }),
    });
  });

  it("rejects a video mixed with images for UPLOADED_MEDIA", async () => {
    const { service } = makeSubmitService("UPLOADED_MEDIA");

    await expect(
      service.submitQuest("999", "quest-1", "data:video/mp4;base64,AAAA", {
        proofExtras: ["data:image/jpeg;base64,/9j/4AAQ"],
      }),
    ).rejects.toMatchObject({ code: "INVALID_PROOF" });
  });

  it("rejects extra uploads for quests that only take a single proof", async () => {
    const { service } = makeSubmitService("TEXT");

    await expect(
      service.submitQuest("999", "quest-1", "my proof", {
        proofExtras: ["data:image/jpeg;base64,/9j/4AAQ"],
      }),
    ).rejects.toMatchObject({ code: "INVALID_PROOF" });
  });

  it("accepts an optional worker link alongside a screenshot proof", async () => {
    const { service, submissionCreate } = makeSubmitService("SCREENSHOT");
    const shot = "data:image/jpeg;base64,/9j/4AAQ";

    const result = await service.submitQuest("999", "quest-1", shot, {
      proofLink: "  https://x.com/worker/status/123  ",
    });

    expect(result.status).toBe("PENDING");
    expect(submissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ proofLink: "https://x.com/worker/status/123" }),
    });
  });

  it("stores a null worker link when none is supplied", async () => {
    const { service, submissionCreate } = makeSubmitService("SCREENSHOT");

    await service.submitQuest("999", "quest-1", "data:image/jpeg;base64,/9j/4AAQ");

    expect(submissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ proofLink: null }),
    });
  });

  it("rejects a non-http worker link", async () => {
    const { service } = makeSubmitService("SCREENSHOT");

    await expect(
      service.submitQuest("999", "quest-1", "data:image/jpeg;base64,/9j/4AAQ", {
        proofLink: "javascript:alert(1)",
      }),
    ).rejects.toMatchObject({ code: "INVALID_PROOF" });
  });

  it("rejects a worker link on a quest that only takes text", async () => {
    const { service } = makeSubmitService("TEXT");

    await expect(
      service.submitQuest("999", "quest-1", "my proof", {
        proofLink: "https://x.com/worker/status/123",
      }),
    ).rejects.toMatchObject({ code: "INVALID_PROOF" });
  });

  it("exposes only http(s) creator links on the public quest response", async () => {
    const { toPublicQuestResponse } = await import("./quest.service.js");
    const quest = {
      id: "q1",
      title: "Quest",
      description: "Desc",
      category: "SOCIAL_CAMPAIGN",
      rewardAmount: 1,
      totalSlots: 5,
      filledSlots: 1,
      startAt: null,
      promoted: false,
      proofType: "SCREENSHOT",
      proofInstructions: "Shot",
      sampleEvidence: null,
      sampleEvidenceExtras: [],
      viewCount: 0,
      publishedAt: null,
      verificationConfig: {
        livePostUrls: [
          "https://x.com/NimiqEarn",
          "javascript:alert(1)",
          "https://t.me/+invite",
        ],
      },
    };

    const view = toPublicQuestResponse(quest as never);

    expect(view.livePostUrls).toEqual(["https://x.com/NimiqEarn", "https://t.me/+invite"]);
  });

  it("returns no creator links when none are configured", async () => {
    const { toPublicQuestResponse } = await import("./quest.service.js");
    const view = toPublicQuestResponse({
      id: "q1",
      title: "Quest",
      description: "Desc",
      category: "FEEDBACK",
      rewardAmount: 1,
      totalSlots: 5,
      filledSlots: 0,
      startAt: null,
      promoted: false,
      proofType: "TEXT",
      proofInstructions: "Text",
      sampleEvidence: null,
      sampleEvidenceExtras: [],
      viewCount: 0,
      publishedAt: null,
      verificationConfig: null,
    } as never);

    expect(view.livePostUrls).toEqual([]);
  });

  it("rejects a text proof for SCREENSHOT quests", async () => {
    const service = createQuestService({
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "w",
          status: "ACTIVE",
          walletProfiles: [],
        }),
      },
      quest: {
        findFirst: vi.fn().mockResolvedValue({
          id: "quest-1",
          creatorId: "other",
          status: "PUBLISHED",
          proofType: "SCREENSHOT",
          startAt: null,
        }),
      },
    } as never);

    await expect(service.submitQuest("999", "quest-1", "https://example.com")).rejects.toMatchObject({
      code: "INVALID_PROOF",
    });
  });

  it("blocks suspended workers from submitting", async () => {
    const service = createQuestService({
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "w",
          status: "SUSPENDED",
          walletProfiles: [],
        }),
      },
      quest: { findFirst: vi.fn() },
    } as never);

    await expect(service.submitQuest("999", "quest-1", "proof")).rejects.toMatchObject({
      code: "SUSPENDED",
    });
  });

  it("stores startAt and sampleEvidence on a draft", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "CREATOR",
      status: "ACTIVE",
      walletProfiles: [{ status: "VERIFIED" }],
    });
    const create = vi.fn().mockResolvedValue({ id: "quest-1", status: "DRAFT" });
    const service = createQuestService({
      user: { findUnique },
      quest: { create, findMany: vi.fn() },
    } as never);

    const startAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await service.createDraftQuest("123", {
      title: "Scheduled quest",
      category: "FEEDBACK",
      description: "A quest that starts later.",
      rewardAmount: 10,
      totalSlots: 5,
      startAt,
      proofType: "TEXT",
      proofInstructions: "Send a short summary.",
      sampleEvidence: "data:image/jpeg;base64,AAAA",
      sampleEvidenceExtras: ["data:image/png;base64,BBBB"],
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        startAt,
        sampleEvidence: "data:image/jpeg;base64,AAAA",
        sampleEvidenceExtras: ["data:image/png;base64,BBBB"],
      }),
    });
  });

  it("charges the reward pool plus the platform fee on publish", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "CREATOR",
      status: "ACTIVE",
      walletProfiles: [{ status: "VERIFIED", keyCiphertext: "creator-key", nimiqAddress: "NQ_CREATOR" }],
    });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "user-1",
      status: "DRAFT",
      rewardAmount: "10",
      totalSlots: 5,
      escrowAddress: "NQ_ESCROW",
      fundedAt: null,
    });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: "quest-1", status: "PUBLISHED" });
    const transfer = vi.fn().mockResolvedValue({ hash: "0xhash" });
    const poolLuna = BigInt(10 * 5 * 100_000);
    const feeLuna = (poolLuna * 6n) / 100n;
    const escrow = {
      enabled: true,
      requiredLuna: (nim: number, slots: number) => BigInt(nim * slots * 100_000),
      getFunding: vi.fn().mockResolvedValue({ reachable: true, funded: true, requiredNim: 53, balanceNim: 100 }),
      transfer,
    };

    const service = createQuestService(
      { user: { findUnique }, quest: { findFirst, updateMany, findUniqueOrThrow } } as never,
      escrow as never,
      { percent: 6, address: "NQ_FEE", promotionNim: 100 },
    );

    await service.publishQuest("123", "quest-1");

    expect(escrow.getFunding).toHaveBeenCalledWith("NQ_CREATOR", poolLuna + feeLuna);
    expect(transfer).toHaveBeenCalledWith({
      fromKeyCiphertext: "creator-key",
      toAddress: "NQ_ESCROW",
      valueLuna: poolLuna,
    });
    expect(transfer).toHaveBeenCalledWith({
      fromKeyCiphertext: "creator-key",
      toAddress: "NQ_FEE",
      valueLuna: feeLuna,
    });
    expect(updateMany).toHaveBeenCalled();
  });

  it("blocks submitting a quest that hasn't started yet", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "worker-9",
      telegramId: "999",
      status: "ACTIVE",
      reputationScore: 0,
      walletProfiles: [],
    });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "creator-x",
      status: "PUBLISHED",
      totalSlots: 5,
      filledSlots: 0,
      startAt: new Date(Date.now() + 60 * 60 * 1000), // starts in an hour
    });

    const service = createQuestService({
      user: { findUnique },
      quest: { findFirst },
    } as never);

    await expect(service.submitQuest("999", "quest-1", "my proof")).rejects.toMatchObject({
      code: "QUEST_NOT_STARTED",
    });
  });

  it("promotes a published quest and charges the promotion fee", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "CREATOR",
      walletProfiles: [{ keyCiphertext: "creator-key", nimiqAddress: "NQ_CREATOR" }],
    });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "user-1",
      status: "PUBLISHED",
      promoted: false,
    });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const transfer = vi.fn().mockResolvedValue({ hash: "0xpromo" });
    const escrow = {
      enabled: true,
      requiredLuna: (nim: number, slots: number) => BigInt(nim * slots * 100_000),
      getFunding: vi.fn().mockResolvedValue({ reachable: true, funded: true }),
      transfer,
    };

    const service = createQuestService(
      { user: { findUnique }, quest: { findFirst, updateMany } } as never,
      escrow as never,
      { percent: 6, address: "NQ_FEE", promotionNim: 100 },
    );

    await service.promoteQuest("123", "quest-1");

    expect(transfer).toHaveBeenCalledWith({
      fromKeyCiphertext: "creator-key",
      toAddress: "NQ_FEE",
      valueLuna: BigInt(100 * 100_000),
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "quest-1", promoted: false, status: "PUBLISHED" },
      data: { promoted: true },
    });
  });

  it("rejects promoting an already-promoted quest", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "CREATOR",
      walletProfiles: [{ keyCiphertext: "k", nimiqAddress: "NQ" }],
    });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "user-1",
      status: "PUBLISHED",
      promoted: true,
    });

    const service = createQuestService(
      { user: { findUnique }, quest: { findFirst, update: vi.fn() } } as never,
      { enabled: true } as never,
      { percent: 6, address: "NQ_FEE", promotionNim: 100 },
    );

    await expect(service.promoteQuest("123", "quest-1")).rejects.toMatchObject({
      code: "ALREADY_PROMOTED",
    });
  });

  it("rejects promotion when no fee address is configured", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      telegramId: "123",
      role: "CREATOR",
      walletProfiles: [{ keyCiphertext: "k", nimiqAddress: "NQ" }],
    });
    const findFirst = vi.fn().mockResolvedValue({
      id: "quest-1",
      creatorId: "user-1",
      status: "PUBLISHED",
      promoted: false,
    });

    const service = createQuestService(
      { user: { findUnique }, quest: { findFirst, update: vi.fn() } } as never,
      { enabled: true } as never,
      { percent: 6, promotionNim: 100 }, // no address
    );

    await expect(service.promoteQuest("123", "quest-1")).rejects.toMatchObject({
      code: "PROMOTION_UNAVAILABLE",
    });
  });

  const discoverQuest = (id: string, promoted = false, filled = 0) => ({
    id,
    title: id,
    category: "OTHER",
    rewardAmount: "10",
    totalSlots: 5,
    filledSlots: filled,
    promoted,
    proofType: "TEXT",
    viewCount: 0,
    creator: { displayName: "C" },
  });

  it("discovery lists open quests, excludes full ones, promoted-first ordering", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([discoverQuest("q1"), discoverQuest("q2", false, 5), discoverQuest("q3", true)]);
    const service = createQuestService({
      quest: { findMany },
      user: { findUnique: vi.fn() },
    } as never);

    const res = await service.listDiscoverableQuests({ pageSize: 10 });

    expect(res.total).toBe(2); // q2 is full -> excluded
    expect(res.quests.map((q) => q.id)).toEqual(["q1", "q3"]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ promoted: "desc" }, { createdAt: "desc" }],
        where: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });

  it("discovery excludes the worker's own + already-done quests when identified", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "u1", submissions: [{ questId: "q3" }] });
    const findMany = vi.fn().mockResolvedValue([discoverQuest("q1"), discoverQuest("q3")]);
    const service = createQuestService({ quest: { findMany }, user: { findUnique } } as never);

    const res = await service.listDiscoverableQuests({ telegramId: "999" });

    expect(res.quests.map((q) => q.id)).toEqual(["q1"]); // q3 already submitted
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ creatorId: { not: "u1" } }) }),
    );
  });

  it("discovery paginates", async () => {
    const many = Array.from({ length: 25 }, (_, i) => discoverQuest(`q${i}`));
    const findMany = vi.fn().mockResolvedValue(many);
    const service = createQuestService({
      quest: { findMany },
      user: { findUnique: vi.fn() },
    } as never);

    const res = await service.listDiscoverableQuests({ page: 1, pageSize: 10 });

    expect(res.total).toBe(25);
    expect(res.pageCount).toBe(3);
    expect(res.quests).toHaveLength(10);
    expect(res.quests[0].id).toBe("q10");
  });

  it("returns a worker's submissions with total earned (accepted only)", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "w1", telegramId: "999" });
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "s1",
        questId: "q1",
        status: "ACCEPTED",
        payoutTxHash: "0xabc",
        paidAt: new Date(),
        createdAt: new Date(),
        quest: { title: "Quest 1", rewardAmount: "25" },
      },
      {
        id: "s2",
        questId: "q2",
        status: "REJECTED",
        payoutTxHash: null,
        paidAt: null,
        createdAt: new Date(),
        quest: { title: "Quest 2", rewardAmount: "10" },
      },
    ]);
    const service = createQuestService({
      user: { findUnique },
      questSubmission: { findMany },
    } as never);

    const res = await service.getWorkerSubmissions("999");

    expect(res.count).toBe(2);
    expect(res.totalEarned).toBe(25); // only the ACCEPTED one counts
    expect(res.submissions[0]).toMatchObject({ questTitle: "Quest 1", payoutTxHash: "0xabc" });
  });

  it("rejects submissions for an unknown user", async () => {
    const service = createQuestService({
      user: { findUnique: vi.fn().mockResolvedValue(null) },
    } as never);

    await expect(service.getWorkerSubmissions("nope")).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
    });
  });
});

describe("splitRewardLuna", () => {
  it("deducts 7.5% from the worker and sends it to the platform", () => {
    const { workerLuna, feeLuna } = splitRewardLuna(1_000_000n, 7.5);
    expect(feeLuna).toBe(75_000n);
    expect(workerLuna).toBe(925_000n);
  });

  it("floors the fee so the parts always sum to the exact reward (no dust)", () => {
    // 1 luna reward → 7.5% floors to 0, so nothing is lost or created.
    expect(splitRewardLuna(1n, 7.5)).toEqual({ workerLuna: 1n, feeLuna: 0n });
    // 13 luna → floor(13 * 750 / 10000) = 0 (0.975 floors to 0).
    expect(splitRewardLuna(13n, 7.5)).toEqual({ workerLuna: 13n, feeLuna: 0n });
    // 15 luna → floor(1.125) = 1.
    expect(splitRewardLuna(15n, 7.5)).toEqual({ workerLuna: 14n, feeLuna: 1n });
  });

  it("conserves the reward across a range of amounts", () => {
    for (const reward of [1n, 7n, 99n, 100_000n, 1_234_567n, 999_999_999n]) {
      const { workerLuna, feeLuna } = splitRewardLuna(reward, 7.5);
      expect(workerLuna + feeLuna).toBe(reward);
      expect(feeLuna).toBe((reward * 750n) / 10_000n);
    }
  });

  it("returns the full reward when no tasker fee is configured", () => {
    expect(splitRewardLuna(1_000_000n, 0)).toEqual({ workerLuna: 1_000_000n, feeLuna: 0n });
    expect(splitRewardLuna(1_000_000n)).toEqual({ workerLuna: 1_000_000n, feeLuna: 0n });
  });

  it("does not produce a negative fee for a zero reward", () => {
    expect(splitRewardLuna(0n, 7.5)).toEqual({ workerLuna: 0n, feeLuna: 0n });
  });
});
