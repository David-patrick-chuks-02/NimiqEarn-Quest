import type { ApiUser } from "../api/client.js";
import { escapeMarkdown } from "../utils/markdown.js";

/** Compact worker profile shown under "Start Earning" (balance/address are in the header). */
export function formatWorkerStatus(user: ApiUser): string {
  const name = escapeMarkdown(user.displayName ?? "Worker");
  return [
    "*Your profile*",
    `_${name}_`,
    "",
    `Wallet · ${user.wallet ? "Ready" : "Not set up yet"}`,
    `Reputation · ${user.reputationScore} pts`,
    "",
    "Tap *Start Earning* to browse open quests by category and earn NIM.",
  ].join("\n");
}
