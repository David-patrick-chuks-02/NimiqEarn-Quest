import type { PublicQuest } from "../api/client.js";
import { escapeMarkdown } from "../utils/markdown.js";

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
    `💰 *Reward:* ${escapeMarkdown(Number(quest.rewardAmount).toLocaleString())} NIM`,
    `🎟 *Slots:* ${quest.slotsLeft} of ${quest.totalSlots} left`,
    `⏰ *Deadline:* ${formatDeadline(quest.deadline)}`,
    `📎 *Proof:* ${escapeMarkdown(proof)} — ${escapeMarkdown(quest.proofInstructions)}`,
    "",
    escapeMarkdown(quest.description),
    "",
    "_Complete quests to earn NIM. Getting set up takes a minute — finish onboarding below and link your wallet so you're ready to submit when this quest opens for completion._",
  ].join("\n");
}
