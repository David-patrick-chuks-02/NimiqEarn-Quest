import { describe, expect, it } from "vitest";
import {
  buildAdminAuthConfig,
  createAdminSessionToken,
  extractAdminToken,
  verifyAdminCredentials,
  verifyAdminSessionToken,
} from "./admin-auth.service.js";

describe("admin-auth.service", () => {
  const cfg = buildAdminAuthConfig({
    email: "Admin@Example.com",
    password: "secret-pass",
    sessionSecret: "test-session-secret",
  })!;

  it("normalizes email and verifies credentials", () => {
    expect(cfg.email).toBe("admin@example.com");
    expect(verifyAdminCredentials(cfg, "ADMIN@example.com", "secret-pass")).toBe(true);
    expect(verifyAdminCredentials(cfg, "admin@example.com", "wrong")).toBe(false);
    expect(verifyAdminCredentials(cfg, "other@example.com", "secret-pass")).toBe(false);
  });

  it("issues and verifies session tokens", () => {
    const { token, email } = createAdminSessionToken(cfg);
    expect(email).toBe("admin@example.com");
    expect(verifyAdminSessionToken(token, cfg)?.email).toBe("admin@example.com");
    expect(verifyAdminSessionToken("bad.token", cfg)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const { token } = createAdminSessionToken(cfg, Date.now() - 1000 * 60 * 60 * 24 * 8);
    expect(verifyAdminSessionToken(token, cfg)).toBeNull();
  });

  it("extracts bearer and x-admin-token", () => {
    expect(extractAdminToken({ authorization: "Bearer abc.def" })).toBe("abc.def");
    expect(extractAdminToken({ "x-admin-token": "xyz" })).toBe("xyz");
    expect(extractAdminToken({})).toBeUndefined();
  });
});
