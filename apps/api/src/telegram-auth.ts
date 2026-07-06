import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramInitDataUser {
  telegramId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

// Reject initData older than this to limit replay of a captured payload.
const MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * Verify a Telegram Mini App `initData` string and return the authenticated user, or null.
 *
 * The Mini App is only trusted after checking its HMAC against the bot token:
 *   secret_key   = HMAC_SHA256(key="WebAppData", data=bot_token)
 *   expected_hash = HMAC_SHA256(key=secret_key, data=data_check_string)
 * where data_check_string is every field except `hash`, sorted, joined by "\n".
 *
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  now: () => number = () => Date.now(),
): TelegramInitDataUser | null {
  if (!initData || !botToken) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]+$/i.test(hash)) return null;

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const expected = Buffer.from(computedHash, "hex");
  const received = Buffer.from(hash, "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || now() / 1000 - authDate > MAX_AGE_SECONDS) {
    return null;
  }

  const userRaw = params.get("user");
  if (!userRaw) return null;
  let user: { id?: number; first_name?: string; last_name?: string; username?: string };
  try {
    user = JSON.parse(userRaw) as typeof user;
  } catch {
    return null;
  }
  if (typeof user.id !== "number") return null;

  return {
    telegramId: String(user.id),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
  };
}
