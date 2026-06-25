import type { ApiUser } from "../api/client.js";

export function formatWorkerStatus(user: ApiUser): string {
  const name = user.displayName ?? "Worker";
  const statusLabel = formatUserStatus(user.status);
  const reputation = user.reputationScore;
  const walletLine = user.wallet
    ? `Wallet: linked (${formatWalletStatus(user.wallet.status)})`
    : "Wallet: not linked — use /wallet";

  return [
    `*${name}'s worker status*`,
    "",
    `Profile: ${statusLabel}`,
    `Reputation: ${reputation} pts`,
    walletLine,
    "Available quests: none yet",
    "",
    user.wallet
      ? "Quest browsing opens in the next update."
      : "Link your Nimiq wallet with /wallet to receive rewards when quests go live.",
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

function formatWalletStatus(status: string): string {
  switch (status) {
    case "VERIFIED":
      return "verified";
    case "INVALID":
      return "invalid";
    case "PENDING":
    default:
      return "pending";
  }
}
