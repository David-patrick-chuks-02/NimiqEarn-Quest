import type { WalletProfile } from "@nimiqearn/database";

// Wallet formatters used when serialising a user's wallet(s). (The custodial wallet
// lifecycle itself lives in custodial-wallet.service.ts.)

export function toWalletResponse(wallet: WalletProfile) {
  return {
    nimiqAddress: wallet.nimiqAddress,
    status: wallet.status,
    isPrimary: wallet.isPrimary,
    linkedAt: wallet.linkedAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

export function toWalletListItem(wallet: WalletProfile) {
  return {
    id: wallet.id,
    nimiqAddress: wallet.nimiqAddress,
    status: wallet.status,
    isPrimary: wallet.isPrimary,
    linkedAt: wallet.linkedAt.toISOString(),
  };
}
