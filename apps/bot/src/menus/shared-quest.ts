import { InlineKeyboard } from "grammy";
import type { PublicQuest } from "../api/client.js";
import { escapeMarkdown } from "../utils/markdown.js";

/**
 * Inline keyboard for a shared quest: a web_app button that opens the "do this quest" Mini
 * App. web_app buttons require HTTPS, so returns null in local/non-HTTPS dev (message only).
 */
export function sharedQuestKeyboard(questId: string): InlineKeyboard | null {
  const base = (process.env.WEB_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!base.startsWith("https://")) return null;
  return new InlineKeyboard().webApp("Do this quest", `${base}/quest/${questId}`);
}

const CATEGORY_LABELS: Record<string, string> = {
  PRODUCT_TESTING: "Product testing",
  SOCIAL_CAMPAIGN: "Social campaign",
  COMMUNITY_ENGAGEMENT: "Community engagement",
  REFERRAL: "Referral",
  CONTENT: "Content",
  FEEDBACK: "Feedback",
  BUG_BOUNTY: "Bug bounty",
  OTHER: "Quest",
};

const PROOF_LABELS: Record<string, string> = {
  TEXT: "Text response",
  LINK: "A link / URL",
  SCREENSHOT: "A screenshot",
  TRANSACTION_HASH: "A transaction hash",
  REFERRAL_EVENT: "A referral",
};

function formatDeadline(iso: string): string {
  // YYYY-MM-DD is unambiguous and locale-free for a bot audience.
  return iso.slice(0, 10);
}

/** Detail card shown when someone opens a shared quest link. */
export function formatSharedQuest(quest: PublicQuest): string {
  const category = CATEGORY_LABELS[quest.category] ?? "Quest";
  const proof = PROOF_LABELS[quest.proofType] ?? quest.proofType;
  const by = quest.creatorName ? ` · by *${escapeMarkdown(quest.creatorName)}*` : "";

  return [
    `*${escapeMarkdown(quest.title)}*`,
    `_${category}_${by}`,
    "",
    `*Reward:* ${escapeMarkdown(Number(quest.rewardAmount).toLocaleString())} NIM`,
    `*Slots:* ${quest.slotsLeft} of ${quest.totalSlots} left`,
    `*Deadline:* ${formatDeadline(quest.deadline)}`,
    `*Proof:* ${escapeMarkdown(proof)} — ${escapeMarkdown(quest.proofInstructions)}`,
    "",
    escapeMarkdown(quest.description),
    "",
    "_Tap *Do this quest* below to complete it and earn NIM, paid to your wallet._",
  ].join("\n");
}
