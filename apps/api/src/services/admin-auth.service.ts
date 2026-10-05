import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { safeCompare } from "../security.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export type AdminAuthConfig = {
  email: string;
  password: string;
  /** HMAC secret for session tokens (ADMIN_API_KEY or derived). */
  sessionSecret: string;
};

type SessionPayload = {
  sub: string;
  exp: number;
};

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminAuthConfigured(cfg: AdminAuthConfig | null | undefined): cfg is AdminAuthConfig {
  return Boolean(cfg?.email && cfg?.password && cfg?.sessionSecret);
}

export function buildAdminAuthConfig(input: {
  email?: string;
  password?: string;
  sessionSecret?: string;
}): AdminAuthConfig | null {
  const email = input.email ? normalizeAdminEmail(input.email) : "";
  const password = input.password?.trim() ?? "";
  if (!email || !password) return null;
  const sessionSecret =
    input.sessionSecret?.trim() ||
    createHash("sha256").update(`nimiqearn-admin-session:${email}:${password}`).digest("hex");
  return { email, password, sessionSecret };
}

function b64url(buf: Buffer | string) {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function sign(payloadB64: string, secret: string) {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createAdminSessionToken(cfg: AdminAuthConfig, now = Date.now()) {
  const payload: SessionPayload = {
    sub: cfg.email,
    exp: now + SESSION_TTL_MS,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = sign(payloadB64, cfg.sessionSecret);
  return {
    token: `${payloadB64}.${sig}`,
    expiresAt: new Date(payload.exp).toISOString(),
    email: cfg.email,
  };
}

export function verifyAdminSessionToken(
  token: unknown,
  cfg: AdminAuthConfig,
  now = Date.now(),
): { email: string } | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expected = sign(payloadB64, cfg.sessionSecret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < now) return null;
    if (normalizeAdminEmail(payload.sub) !== cfg.email) return null;
    return { email: cfg.email };
  } catch {
    return null;
  }
}

export function verifyAdminCredentials(
  cfg: AdminAuthConfig,
  email: unknown,
  password: unknown,
): boolean {
  if (typeof email !== "string" || typeof password !== "string") return false;
  const emailOk = safeCompare(normalizeAdminEmail(email), cfg.email);
  const passOk = safeCompare(password, cfg.password);
  return emailOk && passOk;
}

/** Extract Bearer token or x-admin-token header. */
export function extractAdminToken(headers: Record<string, unknown>): string | undefined {
  const auth = headers.authorization;
  if (typeof auth === "string") {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m?.[1]) return m[1].trim();
  }
  const header = headers["x-admin-token"];
  if (typeof header === "string" && header.trim()) return header.trim();
  return undefined;
}

export function checkLoginRateLimit(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const row = loginAttempts.get(ip);
  if (!row || row.resetAt <= now) {
    loginAttempts.set(ip, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return { ok: true };
  }
  if (row.count >= MAX_LOGIN_ATTEMPTS) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((row.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

export function recordLoginFailure(ip: string) {
  const now = Date.now();
  const row = loginAttempts.get(ip);
  if (!row || row.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  row.count += 1;
}

export function clearLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}
