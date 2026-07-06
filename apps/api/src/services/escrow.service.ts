import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { fetchNimiqAccount, generateNimiqKeypair } from "@nimiqearn/nimiq";

const LUNA_PER_NIM = 100_000;

export interface EscrowConfig {
  /** Secret used to derive the AES-256 key. Escrow is disabled when unset. */
  encryptionKey?: string;
  /** Albatross JSON-RPC node for reading escrow balances. */
  rpcUrl?: string;
}

export interface QuestFunding {
  address: string;
  requiredLuna: number;
  requiredNim: number;
  balanceLuna: number | null;
  balanceNim: number | null;
  /** Whether the RPC node answered — funding can't be confirmed when false. */
  reachable: boolean;
  funded: boolean;
}

function deriveKey(secret: string): Buffer {
  // 32 bytes for AES-256, from any-length secret.
  return createHash("sha256").update(secret, "utf8").digest();
}

// Store as iv.tag.ciphertext (all base64) so the whole thing round-trips through one column.
function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

function decrypt(payload: string, key: Buffer): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed escrow ciphertext.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString(
    "utf8",
  );
}

/**
 * Per-quest escrow. Each quest gets its own Nimiq wallet: the creator funds it with the
 * total reward pool, and (in a later milestone) it disburses to workers after verification.
 * The wallet's private key is encrypted at rest — we only ever expose the public address.
 */
export function createEscrowService(config: EscrowConfig) {
  const key = config.encryptionKey ? deriveKey(config.encryptionKey) : null;
  const rpcUrl = config.rpcUrl;

  return {
    /** Escrow provisioning requires an encryption key; funding checks also need an RPC node. */
    enabled: key !== null,
    canCheckFunding: key !== null && Boolean(rpcUrl),

    /** Provision a fresh escrow wallet; returns the public address + encrypted private key. */
    createWallet(): { address: string; keyCiphertext: string } {
      if (!key) throw new Error("Escrow is not configured (ESCROW_ENCRYPTION_KEY missing).");
      const { address, privateKeyHex } = generateNimiqKeypair();
      return { address, keyCiphertext: encrypt(privateKeyHex, key) };
    },

    /** Total funding a quest needs, in luna (1 NIM = 100_000 luna). */
    requiredLuna(rewardNim: number, slots: number): number {
      return Math.round(rewardNim * slots * LUNA_PER_NIM);
    },

    /** Live funding status from the RPC node. `reachable: false` when we can't check. */
    async getFunding(address: string, requiredLuna: number): Promise<QuestFunding> {
      const base = {
        address,
        requiredLuna,
        requiredNim: requiredLuna / LUNA_PER_NIM,
      };
      if (!rpcUrl) {
        return { ...base, balanceLuna: null, balanceNim: null, reachable: false, funded: false };
      }
      const info = await fetchNimiqAccount(rpcUrl, address);
      const balanceLuna = info.balanceLuna;
      return {
        ...base,
        balanceLuna,
        balanceNim: balanceLuna === null ? null : balanceLuna / LUNA_PER_NIM,
        reachable: info.reachable,
        funded: info.reachable && balanceLuna !== null && balanceLuna >= requiredLuna,
      };
    },

    /** Decrypt a stored escrow key. Reserved for disbursement (a later milestone). */
    decryptKey(keyCiphertext: string): string {
      if (!key) throw new Error("Escrow is not configured.");
      return decrypt(keyCiphertext, key);
    },
  };
}

export type EscrowService = ReturnType<typeof createEscrowService>;
