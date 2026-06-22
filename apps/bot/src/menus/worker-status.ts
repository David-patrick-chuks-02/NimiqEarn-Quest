import type { ApiUser } from "../api/client.js";

export function formatWorkerStatus(user: ApiUser): string {
  const name = user.displayName ?? "Worker";
  const statusLabel = formatUserStatus(user.status);
  const reputation = user.reputationScore;

  return [
    `*${name}'s worker status*`,
    "",
    `Profile: ${statusLabel}`,
    `Reputation: ${reputation} pts`,
    "Wallet: not linked yet",
    "Available quests: none yet",
    "",
    "Quest browsing opens in the next update. Link your wallet when /wallet goes live to receive rewards.",
  ].join("\n");
}

function formatUserStatus(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "SUSPENDED":
      return "Suspended";
    case "PENDING":
    default:
      return "Pending verification";
  }
}
