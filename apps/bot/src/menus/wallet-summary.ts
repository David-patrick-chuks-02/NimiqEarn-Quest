import type { ApiClient } from "../api/client.js";

/**
 * Compact wallet header (balance + address) shown at the top of menu screens.
 * Returns "" when the user has no wallet yet. Falls back to "—" when the balance can't be
 * fetched, so a slow/unreachable RPC never blocks the menu from rendering.
 */
export async function walletHeader(api: ApiClient, telegramId: string): Promise<string> {
  let summary: { nimiqAddress: string; balanceNim: number | null; reachable: boolean } | null;
  try {
    summary = await api.getWalletBalance(telegramId);
  } catch {
    return "";
  }
  if (!summary) return "";

  const balance =
    summary.reachable && summary.balanceNim !== null
      ? `${summary.balanceNim.toLocaleString()} NIM`
      : "—";
  return `💰 *Balance:* ${balance}\n\`${summary.nimiqAddress}\`\n\n`;
}
