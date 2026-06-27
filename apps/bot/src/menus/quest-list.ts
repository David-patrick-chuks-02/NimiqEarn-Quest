import type { ApiQuest } from "../api/types.js";
import { InlineKeyboard } from "grammy";
import {
  CATEGORY_LABELS,
  PROOF_TYPE_LABELS,
  QUEST_PUBLISH_CALLBACK_PREFIX,
} from "../conversations/quest-keyboards.js";

const CREATOR_MY_QUESTS_CALLBACK = "creator:my-quests";

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

  const draftCount = quests.filter((quest) => quest.status === "DRAFT").length;
  if (draftCount > 0) {
    lines.push("", "Tap *Publish* below to make a draft live for workers (Milestone 2).");
  }

  return lines.join("\n");
}

export function creatorQuestListKeyboard(quests: ApiQuest[]) {
  const keyboard = new InlineKeyboard();
  const drafts = quests.filter((quest) => quest.status === "DRAFT").slice(0, 5);

  for (const quest of drafts) {
    const label =
      quest.title.length > 22 ? `${quest.title.slice(0, 19)}…` : quest.title;
    keyboard.text(`Publish: ${label}`, `${QUEST_PUBLISH_CALLBACK_PREFIX}${quest.id}`).row();
  }

  if (drafts.length > 0 || quests.length > 0) {
    keyboard.text("Refresh list", CREATOR_MY_QUESTS_CALLBACK).row();
  }

  return keyboard;
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
