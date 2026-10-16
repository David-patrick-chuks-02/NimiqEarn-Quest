import { describe, expect, it } from "vitest";
import { createQuestSchema, updatePublishedQuestSchema } from "@nimiqearn/shared";
import { buildQuestContentPayload, questToForm, toLocalInputValue } from "./utils";
import { emptyForm } from "./constants";
import type { EditableQuest, QuestForm } from "./types";

/**
 * Regression tests for the create/edit payload split.
 *
 * The bug these exist to prevent: the edit form sent `proofType`, the API's edit schema omits it
 * and is `.strict()`, so every save failed with "Invalid quest data." The unit tests missed it
 * because they exercised the service with hand-written payloads instead of the body the form
 * actually builds. These tests run the real builder against the real schemas.
 */

/** The live campaign quest this was reported on. */
const screenshotForm: QuestForm = {
  ...emptyForm,
  title: "NimiqEarn First Community Campaign",
  category: "COMMUNITY_ENGAGEMENT",
  description: "Do the community actions described below.",
  proofType: "SCREENSHOT",
  proofInstructions: "Upload a clear screenshot showing the completed action.",
  livePostUrls: [
    "https://x.com/NimiqEarn",
    "https://x.com/NimiqEarn/status/2103776160089808914",
    "https://t.me/+BpCRHc3uPl85MGZk",
  ],
  deadlineAt: "2026-11-01T18:00",
};

function build(form: QuestForm) {
  const built = buildQuestContentPayload(form);
  if (!built.ok) throw new Error(`builder failed: ${built.error}`);
  return built;
}

describe("buildQuestContentPayload", () => {
  it("produces an edit body the API accepts", () => {
    const { content, verificationConfig } = build(screenshotForm);

    // Exactly what `saveEdit` sends on PATCH.
    const parsed = updatePublishedQuestSchema.safeParse({ ...content, verificationConfig });

    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("produces a create body the API accepts", () => {
    const { content, createOnly, verificationConfig } = build(screenshotForm);

    const parsed = createQuestSchema.safeParse({
      ...content,
      ...createOnly,
      rewardAmount: 1500,
      totalSlots: 50,
      verificationConfig,
    });

    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("keeps every locked field out of the edit half", () => {
    const { content, createOnly } = build(screenshotForm);

    for (const locked of ["rewardAmount", "totalSlots", "startAt", "proofType"]) {
      expect(content).not.toHaveProperty(locked);
    }
    // proofType is create-only: creation still needs it, editing must never send it.
    expect(createOnly).toEqual({ proofType: "SCREENSHOT" });
  });

  it("would fail if proofType leaked into the edit body again", () => {
    const { content, createOnly, verificationConfig } = build(screenshotForm);

    // This is the exact regression. If someone folds createOnly back into content, this catches it.
    const leaked = updatePublishedQuestSchema.safeParse({
      ...content,
      ...createOnly,
      verificationConfig,
    });

    expect(leaked.success).toBe(false);
    expect(JSON.stringify(leaked.error?.issues)).toContain("proofType");
  });

  it("sends the campaign links and deadline, which is what creators come here to fix", () => {
    const { verificationConfig } = build(screenshotForm);

    expect(verificationConfig.livePostUrls).toEqual(screenshotForm.livePostUrls);
    expect(verificationConfig.deadlineAt).toBe(new Date("2026-11-01T18:00").toISOString());
  });

  it("always returns a verificationConfig object, even when no rules are set", () => {
    const { verificationConfig } = build({ ...emptyForm, title: "x", description: "y" });

    // An edit must send this even when empty, so clearing the last rule actually clears it.
    expect(verificationConfig).toEqual({});
  });

  it("still rejects a malformed campaign link", () => {
    const built = buildQuestContentPayload({ ...screenshotForm, livePostUrls: ["not-a-url"] });

    expect(built.ok).toBe(false);
    expect(built.ok === false && built.error).toContain("Live post URLs");
  });
});

describe("questToForm -> build round trip", () => {
  const stored: EditableQuest = {
    id: "q1",
    status: "PUBLISHED",
    title: "NimiqEarn First Community Campaign",
    category: "COMMUNITY_ENGAGEMENT",
    description: "Do the community actions described below.",
    proofType: "SCREENSHOT",
    proofInstructions: "Upload a clear screenshot showing the completed action.",
    sampleEvidence: null,
    sampleEvidenceExtras: [],
    verificationConfig: {
      deadlineAt: "2026-10-15T17:00:00.000Z",
      livePostUrls: [
        "https://x.com/NimiqEarn",
        "https://x.com/NimiqEarn/status/2103776160089808914",
        "https://t.me/+BpCRHc3uPl85MGZk",
      ],
    },
    rewardAmount: "1500",
    totalSlots: 50,
    filledSlots: 12,
    startAt: "2026-10-12T16:05:00.000Z",
  };

  it("re-saves a loaded quest without mangling the data it can edit", () => {
    const form = questToForm(stored);
    const { content, verificationConfig } = build(form);

    const parsed = updatePublishedQuestSchema.safeParse({ ...content, verificationConfig });

    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    // Untouched fields survive the load/save cycle unchanged.
    expect(content.title).toBe(stored.title);
    expect(content.proofInstructions).toBe(stored.proofInstructions);
    expect(verificationConfig.livePostUrls).toEqual(stored.verificationConfig!.livePostUrls);
    expect(verificationConfig.deadlineAt).toBe(stored.verificationConfig!.deadlineAt);
  });

  it("carries an extended deadline through, which is the case that was failing", () => {
    const form = questToForm(stored);
    // Creator extends the expired deadline by two weeks.
    form.deadlineAt = "2026-10-30T18:00";

    const { content, verificationConfig } = build(form);
    const parsed = updatePublishedQuestSchema.safeParse({ ...content, verificationConfig });

    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(verificationConfig.deadlineAt).toBe(new Date("2026-10-30T18:00").toISOString());
  });

  it("maps an empty config to one blank link row, still valid to save", () => {
    const form = questToForm({ ...stored, verificationConfig: null });

    expect(form.livePostUrls).toEqual([""]);
    const { content, verificationConfig } = build(form);
    expect(updatePublishedQuestSchema.safeParse({ ...content, verificationConfig }).success).toBe(
      true,
    );
    expect(verificationConfig.livePostUrls).toBeUndefined();
  });
});

describe("toLocalInputValue", () => {
  it("formats an ISO timestamp for a datetime-local input", () => {
    expect(toLocalInputValue("2026-10-15T17:00:00.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("returns empty for missing or unparseable values", () => {
    expect(toLocalInputValue(null)).toBe("");
    expect(toLocalInputValue("nonsense")).toBe("");
  });
});
