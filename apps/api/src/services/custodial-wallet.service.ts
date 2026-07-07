import type { PrismaClient } from "@nimiqearn/database";
import {
  buildBasicTransaction,
  fetchNimiqAccount,
  generateNimiqKeypair,
  getRpcBlockNumber,
  networkIdFor,
  sendRawTransaction,
  validateNimiqAddress,
} from "@nimiqearn/nimiq";
import { createSecretBox } from "../crypto.js";
import { getNimUsdPrice } from "./price.js";

export class CustodialWalletError extends Error {
  constructor(
    message: string,
    readonly code:
      | "USER_NOT_FOUND"
      | "SUSPENDED"
      | "NOT_CONFIGURED"
      | "NO_WALLET"
      | "INVALID_ADDRESS"
      | "INVALID_AMOUNT"
      | "INSUFFICIENT_FUNDS"
      | "RPC_UNAVAILABLE"
      | "WITHDRAW_FAILED",
  ) {
    super(message);
    this.name = "CustodialWalletError";
  }
}

export interface CustodialWalletConfig {
  encryptionKey?: string;
  rpcUrl?: string;
  /** "testnet" | "mainnet" — selects the transaction network id. */
  network?: string;
}

const LUNA_PER_NIM = 100_000;

/**
 * Custodial wallets: the platform generates and holds (encrypted) each user's Nimiq key.
 * The plaintext private key is returned ONLY at creation/export time so the bot can show it
 * to the user once — it is never stored in the clear and never exposed in list responses.
 */
export function createCustodialWalletService(db: PrismaClient, config: CustodialWalletConfig) {
  const box = createSecretBox(config.encryptionKey);
  const rpcUrl = config.rpcUrl;
  const networkId = networkIdFor(config.network);

  async function requireUser(telegramId: string) {
    if (!box.enabled) {
      throw new CustodialWalletError("Wallets are not configured.", "NOT_CONFIGURED");
    }
    const user = await db.user.findUnique({
      where: { telegramId },
      include: { walletProfiles: true },
    });
    if (!user) throw new CustodialWalletError("User not found.", "USER_NOT_FOUND");
    if (user.status === "SUSPENDED") {
      throw new CustodialWalletError("Account is suspended.", "SUSPENDED");
    }
    return user;
  }

  return {
    enabled: box.enabled,

    /**
     * Return the user's custodial wallet, creating one if they don't have it yet.
     * Includes the plaintext private key so the caller can show it once.
     */
    async getOrCreate(
      telegramId: string,
    ): Promise<{ address: string; privateKeyHex: string; created: boolean }> {
      const user = await requireUser(telegramId);

      const existing = user.walletProfiles.find((w) => w.keyCiphertext);
      if (existing?.keyCiphertext) {
        return {
          address: existing.nimiqAddress,
          privateKeyHex: box.decrypt(existing.keyCiphertext),
          created: false,
        };
      }

      const { address, privateKeyHex } = generateNimiqKeypair();
      const keyCiphertext = box.encrypt(privateKeyHex);
      try {
        await db.$transaction(async (tx) => {
          const count = await tx.walletProfile.count({ where: { userId: user.id } });
          await tx.walletProfile.create({
            data: {
              userId: user.id,
              nimiqAddress: address,
              status: "VERIFIED",
              isPrimary: count === 0,
              keyCiphertext,
            },
          });
          await tx.walletAddressAudit.create({
            data: { userId: user.id, oldAddress: null, newAddress: address },
          });
          await tx.user.updateMany({
            where: { id: user.id, status: "PENDING" },
            data: { status: "ACTIVE" },
          });
        });
      } catch (error) {
        // Lost a concurrent-create race (unique userId or nimiqAddress) — return the wallet
        // the winning transaction created instead of a duplicate.
        if ((error as { code?: string }).code === "P2002") {
          const again = await requireUser(telegramId);
          const w = again.walletProfiles.find((x) => x.keyCiphertext);
          if (w?.keyCiphertext) {
            return { address: w.nimiqAddress, privateKeyHex: box.decrypt(w.keyCiphertext), created: false };
          }
        }
        throw error;
      }
      return { address, privateKeyHex, created: true };
    },

    /** Decrypt and return the user's custodial key (for an on-demand backup in Settings). */
    async exportKey(telegramId: string): Promise<{ address: string; privateKeyHex: string }> {
      const user = await requireUser(telegramId);
      const wallet = user.walletProfiles.find((w) => w.keyCiphertext);
      if (!wallet?.keyCiphertext) {
        throw new CustodialWalletError("No custodial wallet to back up.", "NO_WALLET");
      }
      return { address: wallet.nimiqAddress, privateKeyHex: box.decrypt(wallet.keyCiphertext) };
    },

    /** On-chain balance of the user's custodial wallet (best-effort), in NIM and USD. */
    async getBalance(telegramId: string): Promise<{
      nimiqAddress: string;
      balanceNim: number | null;
      balanceUsd: number | null;
      reachable: boolean;
    } | null> {
      const user = await db.user.findUnique({
        where: { telegramId },
        include: { walletProfiles: true },
      });
      if (!user) return null;
      if (user.status === "SUSPENDED") {
        throw new CustodialWalletError("Account is suspended.", "SUSPENDED");
      }
      // Prefer the custodial wallet so the balance matches what export/create return.
      const wallet =
        user.walletProfiles.find((w) => w.keyCiphertext) ??
        user.walletProfiles.find((w) => w.isPrimary) ??
        user.walletProfiles[0] ??
        null;
      if (!wallet) return null;
      if (!rpcUrl) {
        return { nimiqAddress: wallet.nimiqAddress, balanceNim: null, balanceUsd: null, reachable: false };
      }

      const [info, usdPrice] = await Promise.all([
        fetchNimiqAccount(rpcUrl, wallet.nimiqAddress),
        getNimUsdPrice(),
      ]);
      const balanceNim = info.balanceLuna === null ? null : info.balanceLuna / LUNA_PER_NIM;
      return {
        nimiqAddress: wallet.nimiqAddress,
        balanceNim,
        balanceUsd: balanceNim !== null && usdPrice !== null ? balanceNim * usdPrice : null,
        reachable: info.reachable,
      };
    },

    /**
     * Send NIM from the user's custodial wallet to an external address.
     * `amount` is in NIM, or "all" to sweep the balance. Builds + signs offline (we hold
     * the key) and broadcasts via the RPC. Returns the tx hash + amount actually sent.
     */
    async withdraw(
      telegramId: string,
      recipient: string,
      amount: number | "all",
    ): Promise<{ hash: string; sentNim: number; recipient: string }> {
      const user = await requireUser(telegramId);
      const wallet = user.walletProfiles.find((w) => w.keyCiphertext);
      if (!wallet?.keyCiphertext) {
        throw new CustodialWalletError("No custodial wallet to withdraw from.", "NO_WALLET");
      }

      const validation = validateNimiqAddress(recipient);
      if (!validation.valid || !validation.normalized) {
        throw new CustodialWalletError("That isn't a valid Nimiq address.", "INVALID_ADDRESS");
      }
      const to = validation.normalized;

      if (!rpcUrl) {
        throw new CustodialWalletError("Withdrawals are not available right now.", "RPC_UNAVAILABLE");
      }

      const account = await fetchNimiqAccount(rpcUrl, wallet.nimiqAddress);
      if (!account.reachable || account.balanceLuna === null) {
        throw new CustodialWalletError(
          "Couldn't reach the Nimiq network. Please try again shortly.",
          "RPC_UNAVAILABLE",
        );
      }
      const balanceLuna = account.balanceLuna;

      // Fee 0 for a basic transfer; "all" sweeps the whole balance.
      const feeLuna = 0n;
      let valueLuna: bigint;
      if (amount === "all") {
        valueLuna = BigInt(balanceLuna) - feeLuna;
      } else {
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new CustodialWalletError("Enter a positive amount to withdraw.", "INVALID_AMOUNT");
        }
        valueLuna = BigInt(Math.round(amount * LUNA_PER_NIM));
      }
      if (valueLuna <= 0n || valueLuna + feeLuna > BigInt(balanceLuna)) {
        throw new CustodialWalletError(
          "You don't have enough balance for that withdrawal.",
          "INSUFFICIENT_FUNDS",
        );
      }

      const validityStartHeight = await getRpcBlockNumber(rpcUrl);
      if (validityStartHeight === null) {
        throw new CustodialWalletError(
          "Couldn't reach the Nimiq network. Please try again shortly.",
          "RPC_UNAVAILABLE",
        );
      }

      const { hex } = buildBasicTransaction({
        privateKeyHex: box.decrypt(wallet.keyCiphertext),
        recipient: to,
        valueLuna,
        feeLuna,
        validityStartHeight,
        networkId,
      });

      const result = await sendRawTransaction(rpcUrl, hex);
      if (!result.hash) {
        throw new CustodialWalletError(
          result.error ?? "The withdrawal could not be broadcast.",
          "WITHDRAW_FAILED",
        );
      }

      return { hash: result.hash, sentNim: Number(valueLuna) / LUNA_PER_NIM, recipient: to };
    },
  };
}

export type CustodialWalletService = ReturnType<typeof createCustodialWalletService>;
