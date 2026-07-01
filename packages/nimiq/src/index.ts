import { createHash } from "node:crypto";
import { Address, PrivateKey, PublicKey, Signature } from "@nimiq/core";

export function validateNimiqAddress(address: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const trimmed = address.trim().replace(/\s+/g, "");

  if (!trimmed) {
    return { valid: false, error: "Address is required." };
  }

  try {
    const parsed = Address.fromUserFriendlyAddress(trimmed);
    return { valid: true, normalized: parsed.toUserFriendlyAddress() };
  } catch {
    return { valid: false, error: "Invalid Nimiq address." };
  }
}

// Prefix used by the Nimiq Keyguard / Hub when signing arbitrary messages.
const NIMIQ_MESSAGE_PREFIX = "\x16Nimiq Signed Message:\n";

/**
 * Reproduces the data that a Nimiq wallet actually signs for an arbitrary message:
 * SHA-256 over `\x16Nimiq Signed Message:\n` + byteLength + message.
 * The resulting 32-byte digest is what the Ed25519 signature is created over.
 */
export function hashNimiqMessage(message: string): Uint8Array {
  const messageBytes = Buffer.from(message, "utf8");
  const prefixBytes = Buffer.from(`${NIMIQ_MESSAGE_PREFIX}${messageBytes.length}`, "utf8");
  const data = Buffer.concat([prefixBytes, messageBytes]);
  return new Uint8Array(createHash("sha256").update(data).digest());
}

/** Builds the human-readable challenge a user signs to prove wallet ownership. */
export function buildVerificationMessage(address: string, code: string): string {
  return [
    "NimiqEarn Quest — wallet verification",
    `Address: ${address}`,
    `Code: ${code}`,
    "",
    "Sign this message to prove you own this wallet.",
    "It authorizes no transaction and moves no funds.",
  ].join("\n");
}

/**
 * Test/dev helper: generate a throwaway keypair and produce a valid signed proof
 * for `message`, exactly as a Nimiq wallet would. Useful for exercising verification
 * without a real wallet.
 */
export function signMessageWithRandomKey(message: string): {
  address: string;
  publicKey: string;
  signature: string;
} {
  const privateKey = PrivateKey.generate();
  const publicKey = PublicKey.derive(privateKey);
  const signature = Signature.create(privateKey, publicKey, hashNimiqMessage(message));
  return {
    address: publicKey.toAddress().toUserFriendlyAddress(),
    publicKey: publicKey.toHex(),
    signature: signature.toHex(),
  };
}

export interface VerifySignedMessageInput {
  /** Expected signer, user-friendly Nimiq address. */
  address: string;
  /** Exact message that was signed. */
  message: string;
  /** Signer public key (hex). */
  publicKey: string;
  /** Ed25519 signature (hex). */
  signature: string;
}

/**
 * Verifies a Nimiq signed message: the signature must be valid for the public key
 * over the (prefixed, hashed) message, AND the public key must derive to `address`.
 * Returns false on any malformed input rather than throwing.
 */
export function verifyNimiqSignedMessage(input: VerifySignedMessageInput): boolean {
  try {
    const publicKey = PublicKey.fromHex(input.publicKey);
    const signature = Signature.fromHex(input.signature);
    const data = hashNimiqMessage(input.message);

    if (!publicKey.verify(signature, data)) {
      return false;
    }

    const derived = publicKey.toAddress().toUserFriendlyAddress();
    const expected = Address.fromUserFriendlyAddress(input.address).toUserFriendlyAddress();
    return derived === expected;
  } catch {
    return false;
  }
}
