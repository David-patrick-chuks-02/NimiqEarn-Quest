import {
  buildBasicTransaction,
  fetchNimiqAccount,
  fetchNimiqTransactions,
  generateNimiqKeypair,
  getRpcBlockNumber,
  networkIdFor,
  sendRawTransaction,
  type NimiqTx,
} from "@nimiqearn/nimiq";
import { createSecretBox } from "../crypto.js";

const LUNA_PER_NIM = 100_000;

export interface EscrowConfig {
  /** Secret used to derive the AES-256 key. Escrow is disabled when unset. */
  encryptionKey?: string;
  /** Albatross JSON-RPC node for reading escrow balances. */
  rpcUrl?: string;
  /** "testnet" | "mainnet" — selects the transaction network id. */
  network?: string;
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

/**
 * Per-quest escrow. Each quest gets its own Nimiq wallet: the creator funds it with the
 * total reward pool, and (in a later milestone) it disburses to workers after verification.
 * The wallet's private key is encrypted at rest — we only ever expose the public address.
 */
export function createEscrowService(config: EscrowConfig) {
  const box = createSecretBox(config.encryptionKey);
  const rpcUrl = config.rpcUrl;
  const networkId = networkIdFor(config.network);

  return {
    /** Escrow provisioning requires an encryption key; funding checks also need an RPC node. */
    enabled: box.enabled,
    canCheckFunding: box.enabled && Boolean(rpcUrl),

    /**
     * Move `valueLuna` from a wallet we hold (its encrypted key) to `toAddress`, on-chain.
     * Used to fund a quest's escrow from the creator's custodial wallet at publish time.
     */
    async transfer(params: {
      fromKeyCiphertext: string;
      toAddress: string;
      valueLuna: bigint;
    }): Promise<{ hash?: string; error?: string }> {
      if (!box.enabled || !rpcUrl) return { error: "Payments are not configured." };
      const validityStartHeight = await getRpcBlockNumber(rpcUrl);
      if (validityStartHeight === null) return { error: "The Nimiq network was unreachable." };
      const { hex } = buildBasicTransaction({
        privateKeyHex: box.decrypt(params.fromKeyCiphertext),
        recipient: params.toAddress,
        valueLuna: params.valueLuna,
        feeLuna: 0n,
        validityStartHeight,
        networkId,
      });
      return sendRawTransaction(rpcUrl, hex);
    },

    /** Provision a fresh escrow wallet; returns the public address + encrypted private key. */
    createWallet(): { address: string; keyCiphertext: string } {
      if (!box.enabled) throw new Error("Escrow is not configured (ESCROW_ENCRYPTION_KEY missing).");
      const { address, privateKeyHex } = generateNimiqKeypair();
      return { address, keyCiphertext: box.encrypt(privateKeyHex) };
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
      return box.decrypt(keyCiphertext);
    },

    /** Recent on-chain transactions for an address, or null when unavailable. */
    async getTransactions(address: string): Promise<NimiqTx[] | null> {
      if (!rpcUrl) return null;
      return fetchNimiqTransactions(rpcUrl, address);
    },

    /** NimiqWatch explorer link for a transaction hash (for on-chain transparency). */
    explorerTxUrl(hash: string): string {
      const base =
        config.network === "mainnet"
          ? "https://nimiq.watch"
          : "https://v2.nimiqwatch.com";
      return `${base}/#${hash}`;
    },
  };
}

export type EscrowService = ReturnType<typeof createEscrowService>;
