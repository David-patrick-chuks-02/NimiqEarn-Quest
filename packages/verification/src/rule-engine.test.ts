import { describe, expect, it } from "vitest";
import { runRuleEngine } from "./rule-engine.js";

describe("runRuleEngine", () => {
  it("rejects empty proof", () => {
    const r = runRuleEngine({ proofType: "TEXT", proof: "   " });
    expect(r.passed).toBe(false);
    expect(r.hardFail).toBe(true);
  });

  it("accepts plain text", () => {
    const r = runRuleEngine({ proofType: "TEXT", proof: "Solid feedback about the wallet UX." });
    expect(r.passed).toBe(true);
  });

  it("rejects image for TEXT quests", () => {
    const r = runRuleEngine({
      proofType: "TEXT",
      proof: "data:image/jpeg;base64,AAAA",
    });
    expect(r.passed).toBe(false);
  });

  it("accepts https links", () => {
    const r = runRuleEngine({ proofType: "LINK", proof: "https://x.com/user/status/1" });
    expect(r.passed).toBe(true);
  });

  it("rejects bad links", () => {
    expect(runRuleEngine({ proofType: "LINK", proof: "not-a-url" }).passed).toBe(false);
    expect(runRuleEngine({ proofType: "LINK", proof: "ftp://example.com" }).passed).toBe(false);
  });

  it("accepts screenshot data URLs", () => {
    const r = runRuleEngine({
      proofType: "SCREENSHOT",
      proof: "data:image/jpeg;base64,/9j/4AAQ",
    });
    expect(r.passed).toBe(true);
  });

  it("rejects svg screenshots", () => {
    const r = runRuleEngine({
      proofType: "SCREENSHOT",
      proof: "data:image/svg+xml;base64,AAAA",
    });
    expect(r.passed).toBe(false);
  });

  it("accepts hex transaction hashes", () => {
    const r = runRuleEngine({
      proofType: "TRANSACTION_HASH",
      proof: "abcdef0123456789",
    });
    expect(r.passed).toBe(true);
  });

  it("rejects short tx hashes", () => {
    expect(runRuleEngine({ proofType: "TRANSACTION_HASH", proof: "abc" }).passed).toBe(false);
  });
});
