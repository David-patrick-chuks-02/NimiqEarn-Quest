import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyInitData } from "./telegram-auth.js";

const BOT_TOKEN = "123456:test-bot-token";

/** Build a valid signed initData string the way the Telegram client does. */
function buildInitData(fields: Record<string, string>): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}

const FIXED_NOW = 1_770_000_000_000; // ms
const freshAuthDate = String(Math.floor(FIXED_NOW / 1000) - 60);
const now = () => FIXED_NOW;

describe("verifyInitData", () => {
  it("accepts a correctly signed payload and returns the user", () => {
    const initData = buildInitData({
      auth_date: freshAuthDate,
      query_id: "abc",
      user: JSON.stringify({ id: 42, first_name: "Ada", username: "ada" }),
    });

    expect(verifyInitData(initData, BOT_TOKEN, now)).toEqual({
      telegramId: "42",
      firstName: "Ada",
      lastName: undefined,
      username: "ada",
    });
  });

  it("rejects a tampered payload", () => {
    const initData = buildInitData({
      auth_date: freshAuthDate,
      user: JSON.stringify({ id: 42, first_name: "Ada" }),
    });
    // Bump the user id to 99 without re-signing → hash no longer matches.
    const tampered = initData.replace(
      encodeURIComponent(JSON.stringify({ id: 42, first_name: "Ada" })),
      encodeURIComponent(JSON.stringify({ id: 99, first_name: "Ada" })),
    );
    expect(tampered).not.toBe(initData);
    expect(verifyInitData(tampered, BOT_TOKEN, now)).toBeNull();
  });

  it("rejects the wrong bot token", () => {
    const initData = buildInitData({
      auth_date: freshAuthDate,
      user: JSON.stringify({ id: 42, first_name: "Ada" }),
    });
    expect(verifyInitData(initData, "999:other-token", now)).toBeNull();
  });

  it("rejects stale initData", () => {
    const initData = buildInitData({
      auth_date: String(Math.floor(FIXED_NOW / 1000) - 48 * 60 * 60),
      user: JSON.stringify({ id: 42, first_name: "Ada" }),
    });
    expect(verifyInitData(initData, BOT_TOKEN, now)).toBeNull();
  });

  it("rejects missing hash or user", () => {
    expect(verifyInitData("auth_date=1&user=%7B%7D", BOT_TOKEN, now)).toBeNull();
    expect(verifyInitData("", BOT_TOKEN, now)).toBeNull();
  });
});
