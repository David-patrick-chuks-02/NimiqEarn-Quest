import { describe, expect, it } from "vitest";
import { createQuestSchema, createUserSchema } from "./index.js";
import { MAX_SAMPLE_EVIDENCE_IMAGE_CHARS } from "./limits.js";

describe("createUserSchema", () => {
  it("accepts a valid telegram user payload", () => {
    const result = createUserSchema.safeParse({
      telegramId: "123456789",
      displayName: "Test User",
      telegramUsername: "testuser",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty telegram id", () => {
    const result = createUserSchema.safeParse({ telegramId: "" });
    expect(result.success).toBe(false);
  });
});

describe("createQuestSchema", () => {
  it("rejects a quest with a non-positive reward", () => {
    const result = createQuestSchema.safeParse({
      title: "Test quest",
      category: "FEEDBACK",
      description: "Long enough description",
      rewardAmount: 0,
      totalSlots: 10,
      proofType: "TEXT",
      proofInstructions: "Write feedback",
    });
    expect(result.success).toBe(false);
  });

  const baseQuest = {
    title: "Test quest",
    category: "FEEDBACK" as const,
    description: "Long enough description",
    rewardAmount: 1,
    totalSlots: 10,
    proofType: "SCREENSHOT" as const,
    proofInstructions: "Upload a screenshot of the follow button",
  };

  const sample = (n: number) => `data:image/jpeg;base64,${"A".repeat(n)}`;

  it("accepts up to 3 sample-evidence images", () => {
    const result = createQuestSchema.safeParse({
      ...baseQuest,
      sampleEvidence: sample(100),
      sampleEvidenceExtras: [sample(100), sample(100)],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fourth sample-evidence image", () => {
    const result = createQuestSchema.safeParse({
      ...baseQuest,
      sampleEvidence: sample(100),
      sampleEvidenceExtras: [sample(100), sample(100), sample(100)],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a sample-evidence image over the per-image cap", () => {
    const result = createQuestSchema.safeParse({
      ...baseQuest,
      sampleEvidence: sample(MAX_SAMPLE_EVIDENCE_IMAGE_CHARS + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-image sample evidence", () => {
    const result = createQuestSchema.safeParse({
      ...baseQuest,
      sampleEvidence: "https://example.com/not-an-image.png",
    });
    expect(result.success).toBe(false);
  });
});
