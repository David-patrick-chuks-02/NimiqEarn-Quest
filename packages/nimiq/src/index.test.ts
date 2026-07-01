import { describe, expect, it } from "vitest";
import { PrivateKey, PublicKey, Signature } from "@nimiq/core";
import {
  buildVerificationMessage,
  hashNimiqMessage,
  validateNimiqAddress,
  verifyNimiqSignedMessage,
} from "./index.js";

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

describe("verifyNimiqSignedMessage", () => {
  function signMessage(message: string) {
    const privateKey = PrivateKey.generate();
    const publicKey = PublicKey.derive(privateKey);
    const data = hashNimiqMessage(message);
    const signature = Signature.create(privateKey, publicKey, data);
    return {
      address: publicKey.toAddress().toUserFriendlyAddress(),
      publicKey: publicKey.toHex(),
      signature: signature.toHex(),
    };
  }

  it("accepts a valid signature from the matching address", () => {
    const message = buildVerificationMessage("NQ...", "ABC123");
    const signed = signMessage(message);

    expect(
      verifyNimiqSignedMessage({
        address: signed.address,
        message,
        publicKey: signed.publicKey,
        signature: signed.signature,
      }),
    ).toBe(true);
  });

  it("rejects a signature over a different message", () => {
    const signed = signMessage("message-a");
    expect(
      verifyNimiqSignedMessage({
        address: signed.address,
        message: "message-b",
        publicKey: signed.publicKey,
        signature: signed.signature,
      }),
    ).toBe(false);
  });

  it("rejects when the public key does not match the claimed address", () => {
    const message = buildVerificationMessage("NQ...", "XYZ789");
    const signed = signMessage(message);
    const other = signMessage(message);

    expect(
      verifyNimiqSignedMessage({
        address: other.address, // different address than the signer
        message,
        publicKey: signed.publicKey,
        signature: signed.signature,
      }),
    ).toBe(false);
  });

  it("returns false on malformed input instead of throwing", () => {
    expect(
      verifyNimiqSignedMessage({
        address: VALID_ADDRESS,
        message: "x",
        publicKey: "not-hex",
        signature: "not-hex",
      }),
    ).toBe(false);
  });
});
