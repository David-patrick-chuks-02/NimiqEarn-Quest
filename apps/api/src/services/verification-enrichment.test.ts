import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSocialPost = vi.fn();
vi.mock("./social-fetch.js", () => ({
  fetchSocialPost: (...args: unknown[]) => fetchSocialPost(...args),
}));

import {
  behavioralRiskFromCounts,
  enrichReferralChecks,
  enrichSocialChecks,
  parseVerificationConfig,
} from "./verification-enrichment.js";

describe("verification enrichment", () => {
  beforeEach(() => {
    fetchSocialPost.mockReset();
  });

  it("validates public X posts via HTML without requiring an API token", async () => {
    fetchSocialPost.mockResolvedValue({
      platform: "x",
      url: "https://x.com/blknoiz06/status/2084873954095993027",
      exists: true,
      deleted: false,
      isPublic: true,
      text: "signs of bottom being in",
      hashtags: [],
      mentions: [],
      engagement: null,
      source: "html",
    });

    const { checks } = await enrichSocialChecks({
      proof: "https://x.com/blknoiz06/status/2084873954095993027",
      proofInstructions: "Post a public tweet",
    });

    expect(checks.find((c) => c.code === "link_reachable")?.passed).toBe(true);
    expect(checks.some((c) => c.code === "link_platform_api")).toBe(false);
  });

  it("parses verificationConfig", () => {
    const cfg = parseVerificationConfig({
      targetAddress: "NQXX TEST",
      minAmountNim: 1.5,
      minReputation: 10,
      requiredHashtags: ["nimiq", "#earn"],
      requiredMentions: ["nimiq"],
      requireFirstQuest: true,
    });
    expect(cfg?.targetAddress).toBe("NQXX TEST");
    expect(cfg?.minAmountNim).toBe(1.5);
    expect(cfg?.minReputation).toBe(10);
    expect(cfg?.requiredHashtags).toEqual(["nimiq", "#earn"]);
    expect(cfg?.requiredMentions).toEqual(["nimiq"]);
    expect(cfg?.requireFirstQuest).toBe(true);
  });

  it("flags self-referral", () => {
    const checks = enrichReferralChecks({
      workerTelegramId: "123",
      proof: "123",
      referred: null,
      referredHasActivity: false,
      referredCompletedQuest: false,
      farmingClusterSize: 0,
      inboundReferralCount: 0,
    });
    expect(checks.find((c) => c.code === "referral_not_self")?.passed).toBe(false);
  });

  it("requires active referred user", () => {
    const checks = enrichReferralChecks({
      workerTelegramId: "111",
      proof: "222",
      referred: { id: "u", telegramId: "222", status: "PENDING" },
      referredHasActivity: false,
      referredCompletedQuest: false,
      farmingClusterSize: 0,
      inboundReferralCount: 0,
    });
    expect(checks.find((c) => c.code === "referral_user_active")?.passed).toBe(false);
  });

  it("flags multi-edge referral reuse", () => {
    const checks = enrichReferralChecks({
      workerTelegramId: "111",
      proof: "222",
      referred: { id: "u", telegramId: "222", status: "ACTIVE" },
      referredHasActivity: true,
      referredCompletedQuest: true,
      farmingClusterSize: 1,
      inboundReferralCount: 3,
    });
    expect(checks.find((c) => c.code === "referral_unique")?.passed).toBe(false);
  });

  it("scores burst submissions as high risk", () => {
    const { risk, checks } = behavioralRiskFromCounts({
      submissionsLastHour: 15,
      submissionsLastDay: 20,
      distinctQuestsLastHour: 10,
      sharedFingerprintUsers: 0,
      sharedIpUsers: 0,
      contentClusterUsers: 0,
    });
    expect(risk).toBeGreaterThanOrEqual(0.7);
    expect(checks.some((c) => !c.passed)).toBe(true);
  });

  it("scores device clusters as high risk", () => {
    const { risk } = behavioralRiskFromCounts({
      submissionsLastHour: 1,
      submissionsLastDay: 1,
      distinctQuestsLastHour: 1,
      sharedFingerprintUsers: 5,
      sharedIpUsers: 0,
      contentClusterUsers: 0,
    });
    expect(risk).toBeGreaterThanOrEqual(0.8);
  });
});
