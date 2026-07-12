import type { ApiClient } from "../api/client.js";

/**
 * Compact balance header shown at the top of menu screens (main menu, Creator Hub).
 * Balance only — the wallet address lives in the Wallet section, not on every screen.
 * Returns "" when the user has no wallet yet. Falls back to a "tap Refresh" hint when the
 * balance can't be fetched, so a slow/unreachable RPC never blocks the menu from rendering.
 */
export async function walletHeader(api: ApiClient, telegramId: string): Promise<string> {
  let summary: Awaited<ReturnType<ApiClient["getWalletBalance"]>>;
  try {
    summary = await api.getWalletBalance(telegramId);
  } catch {
    return "";
  }
  if (!summary) return "";

  let balance = "tap Refresh";
  if (summary.reachable && summary.balanceNim !== null) {
    const usd =
      summary.balanceUsd !== null
        ? ` (~$${summary.balanceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
        : "";
    balance = `${summary.balanceNim.toLocaleString()} NIM${usd}`;
  }
  return `*Balance:* ${balance}\n\n`;
}
