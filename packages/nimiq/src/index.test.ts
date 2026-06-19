import { describe, expect, it } from "vitest";
import { validateNimiqAddress } from "./index.js";

const VALID_ADDRESS = "NQ48 VAXG JD1K YSCM X6H6 DJSL AYN7 FTYF 0KAH";

describe("validateNimiqAddress", () => {
  it("accepts a valid user-friendly Nimiq address", () => {
    const result = validateNimiqAddress(VALID_ADDRESS);
    expect(result.valid).toBe(true);
    expect(result.normalized).toBeTruthy();
  });

  it("accepts an address without spaces", () => {
    const result = validateNimiqAddress(VALID_ADDRESS.replace(/\s+/g, ""));
    expect(result.valid).toBe(true);
  });

  it("rejects an empty address", () => {
    const result = validateNimiqAddress("  ");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it("rejects a malformed address", () => {
    const result = validateNimiqAddress("not-a-nimiq-address");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
