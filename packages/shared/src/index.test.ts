import { describe, expect, it } from "vitest";
import { createQuestSchema, createUserSchema } from "./index.js";

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
});
