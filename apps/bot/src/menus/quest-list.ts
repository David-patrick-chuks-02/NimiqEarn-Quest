import type { ApiQuest } from "../api/types.js";
import { InlineKeyboard } from "grammy";
import {
  CATEGORY_LABELS,
  PROOF_TYPE_LABELS,
  QUEST_PUBLISH_CALLBACK_PREFIX,
} from "../conversations/quest-keyboards.js";
import { escapeMarkdown } from "../utils/markdown.js";

const CREATOR_MY_QUESTS_CALLBACK = "creator:my-quests";

export function formatCreatorQuestList(quests: ApiQuest[]): string {
  if (quests.length === 0) {
    return [
      "*My Quests*",
      "",
      "You have no quests yet.",
      "",
      "Select *Create Quest* from the Creator Hub to draft your first bounty.",
    ].join("\n");
  }

  const lines = ["*My Quests*", ""];
  const drafts = quests.filter((quest) => quest.status === "DRAFT");

  for (const quest of quests.slice(0, 10)) {
    const category = CATEGORY_LABELS[quest.category as keyof typeof CATEGORY_LABELS] ?? quest.category;
    const proof =
      PROOF_TYPE_LABELS[quest.proofType as keyof typeof PROOF_TYPE_LABELS] ?? quest.proofType;
    const deadline = new Date(quest.deadline).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const draftNumber =
      quest.status === "DRAFT" ? drafts.findIndex((draft) => draft.id === quest.id) + 1 : 0;
    const prefix = draftNumber > 0 ? `Draft #${draftNumber} · ` : "";

    lines.push(
      `${prefix}*${escapeMarkdown(quest.title)}*`,
      `Status · ${formatQuestStatus(quest.status)}`,
      `Category · ${category}`,
      `Reward · ${quest.rewardAmount} NIM per slot`,
      `Slots · ${quest.filledSlots}/${quest.totalSlots}`,
      `Deadline · ${deadline}`,
      `Proof · ${proof}`,
      "",
    );
  }

  if (quests.length > 10) {
    lines.push(`_Showing 10 of ${quests.length} quests._`);
  }

  if (drafts.length > 0) {
    lines.push(
      "*Publish a draft*",
      "Select *Publish draft #* below when you are ready to make a quest live.",
    );
  }

  return lines.join("\n");
}

export function creatorQuestListKeyboard(quests: ApiQuest[]) {
  const keyboard = new InlineKeyboard();
  const drafts = quests.filter((quest) => quest.status === "DRAFT").slice(0, 5);

  drafts.forEach((_quest, index) => {
    keyboard
      .text(`Publish draft #${index + 1}`, `${QUEST_PUBLISH_CALLBACK_PREFIX}${drafts[index]!.id}`)
      .row();
  });

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
