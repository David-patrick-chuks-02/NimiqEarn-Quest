import type { ApiQuest } from "../api/types.js";
import { CATEGORY_LABELS, PROOF_TYPE_LABELS } from "../conversations/quest-keyboards.js";

export function formatCreatorQuestList(quests: ApiQuest[]): string {
  if (quests.length === 0) {
    return [
      "*Your quests*",
      "",
      "No quests yet. Tap *Create Quest* to draft your first bounty.",
    ].join("\n");
  }

  const lines = ["*Your quests*", ""];

  for (const quest of quests.slice(0, 10)) {
    const category = CATEGORY_LABELS[quest.category as keyof typeof CATEGORY_LABELS] ?? quest.category;
    const proof =
      PROOF_TYPE_LABELS[quest.proofType as keyof typeof PROOF_TYPE_LABELS] ?? quest.proofType;
    const deadline = new Date(quest.deadline).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    lines.push(
      `*${quest.title}* — ${formatQuestStatus(quest.status)}`,
      `Category: ${category}`,
      `Reward: ${quest.rewardAmount} NIM · Slots: ${quest.filledSlots}/${quest.totalSlots}`,
      `Deadline: ${deadline}`,
      `Proof: ${proof}`,
      "",
    );
  }

  if (quests.length > 10) {
    lines.push(`_Showing 10 of ${quests.length} quests._`);
  }

  return lines.join("\n");
}

function formatQuestStatus(status: string) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PUBLISHED":
      return "Published";
    case "CLOSED":
      return "Closed";
    case "ARCHIVED":
      return "Archived";
    default:
      return status;
  }
}
