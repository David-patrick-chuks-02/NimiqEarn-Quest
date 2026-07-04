import type { ApiUser } from "../api/client.js";
import { escapeMarkdown } from "../utils/markdown.js";

function stepIcon(done: boolean) {
  return done ? "✓" : "○";
}

export function formatWorkerStatus(user: ApiUser): string {
  const name = escapeMarkdown(user.displayName ?? "Worker");
  const reputation = user.reputationScore;
  const walletLinked = Boolean(user.wallet);
  const profileVerified = user.status === "ACTIVE";

  const walletLine = user.wallet
    ? `Wallet · Linked (${formatWalletStatus(user.wallet.status)})`
    : "Wallet · Not linked";

  const lines = [
    `*Worker profile*`,
    `_${name}_`,
    "",
    "*Verification status*",
    `${stepIcon(true)} Profile created`,
    `${stepIcon(walletLinked)} Nimiq wallet linked`,
    `${stepIcon(profileVerified)} Account verified`,
    "",
    "*Overview*",
    `Account status · ${profileVerified ? "Verified" : "Verification required"}`,
    `Reputation · ${reputation} pts`,
    walletLine,
    `Available quests · Coming soon`,
    "",
  ];

  if (!profileVerified) {
    lines.push(
      "*Next step*",
      "Link your Nimiq wallet with /wallet to verify your account.",
      "",
      "_You can link multiple wallets and choose a primary. Each address maps to one account._",
    );
  } else {
    lines.push(
      "Your profile is verified. Published quests will appear here as creators release new opportunities.",
    );
  }

  return lines.join("\n");
}

function formatWalletStatus(status: string) {
  switch (status) {
    case "VERIFIED":
      return "Verified";
    case "INVALID":
      return "Invalid";
    case "PENDING":
    default:
      return "Pending";
  }
}
