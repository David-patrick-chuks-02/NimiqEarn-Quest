import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM secret box for encrypting wallet private keys at rest. The key is derived
 * from any-length secret via SHA-256. Ciphertext is stored as `iv.tag.data` (all base64),
 * so the whole thing round-trips through a single text column.
 *
 * SECURITY: whatever secret backs this is a catastrophic single point of failure — if it
 * leaks, every stored key can be decrypted. Before mainnet this should come from a KMS/HSM,
 * not a plain env var.
 */
export interface SecretBox {
  /** True when a secret was provided (encryption is available). */
  enabled: boolean;
  encrypt(plaintext: string): string;
  decrypt(payload: string): string;
}

export function createSecretBox(secret?: string): SecretBox {
  const key = secret ? createHash("sha256").update(secret, "utf8").digest() : null;

  return {
    enabled: key !== null,

    encrypt(plaintext: string): string {
      if (!key) throw new Error("Encryption key is not configured.");
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
    },

    decrypt(payload: string): string {
      if (!key) throw new Error("Encryption key is not configured.");
      const [ivB64, tagB64, dataB64] = payload.split(".");
      if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed ciphertext.");
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
      decipher.setAuthTag(Buffer.from(tagB64, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(dataB64, "base64")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}
