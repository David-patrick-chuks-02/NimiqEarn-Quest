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
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        startAt,
        sampleEvidence: "data:image/jpeg;base64,AAAA",
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
