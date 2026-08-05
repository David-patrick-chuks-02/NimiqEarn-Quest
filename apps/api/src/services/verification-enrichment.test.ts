import { describe, expect, it } from "vitest";
import {
  behavioralRiskFromCounts,
  enrichReferralChecks,
  parseVerificationConfig,
} from "./verification-enrichment.js";

describe("verification enrichment", () => {
  it("parses verificationConfig", () => {
    const cfg = parseVerificationConfig({
      targetAddress: "NQXX TEST",
      minAmountNim: 1.5,
      minReputation: 10,
      requiredHashtags: ["nimiq", "#earn"],
    });
    expect(cfg?.targetAddress).toBe("NQXX TEST");
    expect(cfg?.minAmountNim).toBe(1.5);
    expect(cfg?.minReputation).toBe(10);
    expect(cfg?.requiredHashtags).toEqual(["nimiq", "#earn"]);
  });

  it("flags self-referral", () => {
    const checks = enrichReferralChecks({
      workerTelegramId: "123",
      proof: "123",
      referred: null,
      referredHasActivity: false,
    });
    expect(checks.find((c) => c.code === "referral_not_self")?.passed).toBe(false);
  });

  it("requires active referred user", () => {
    const checks = enrichReferralChecks({
      workerTelegramId: "111",
      proof: "222",
      referred: { id: "u", telegramId: "222", status: "PENDING" },
      referredHasActivity: false,
    });
    expect(checks.find((c) => c.code === "referral_user_active")?.passed).toBe(false);
  });

  it("scores burst submissions as high risk", () => {
    const { risk, checks } = behavioralRiskFromCounts({
      submissionsLastHour: 15,
      submissionsLastDay: 20,
      distinctQuestsLastHour: 10,
    });
    expect(risk).toBeGreaterThanOrEqual(0.7);
    expect(checks.some((c) => !c.passed)).toBe(true);
  });
});
