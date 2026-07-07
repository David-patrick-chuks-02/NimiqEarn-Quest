import type { ApiClient } from "../api/client.js";

/**
 * Compact wallet header (balance + address) shown at the top of menu screens.
 * Returns "" when the user has no wallet yet. Falls back to "—" when the balance can't be
 * fetched, so a slow/unreachable RPC never blocks the menu from rendering.
 */
export async function walletHeader(api: ApiClient, telegramId: string): Promise<string> {
  let summary: Awaited<ReturnType<ApiClient["getWalletBalance"]>>;
  try {
    summary = await api.getWalletBalance(telegramId);
  } catch {
    return "";
  }
  if (!summary) return "";

  let balance = "tap 🔄 Refresh";
  if (summary.reachable && summary.balanceNim !== null) {
    const usd =
      summary.balanceUsd !== null
        ? ` (~$${summary.balanceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
        : "";
    balance = `${summary.balanceNim.toLocaleString()} NIM${usd}`;
  }
  return `💰 *Balance:* ${balance}\n\`${summary.nimiqAddress}\`\n\n`;
}
