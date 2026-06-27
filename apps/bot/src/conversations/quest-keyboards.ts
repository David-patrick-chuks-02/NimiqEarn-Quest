import { InlineKeyboard } from "grammy";
import type { CreateQuestInput } from "@nimiqearn/shared";
import { NAV_CANCEL } from "../menus/nav.js";

export const QUEST_CATEGORY_CALLBACK_PREFIX = "quest:cat:";
export const QUEST_PROOF_CALLBACK_PREFIX = "quest:proof:";
export const QUEST_CONFIRM_SAVE = "quest:confirm:save";
export const QUEST_CONFIRM_CANCEL = "quest:confirm:cancel";
export const QUEST_PUBLISH_CALLBACK_PREFIX = "quest:publish:";

const CATEGORIES: CreateQuestInput["category"][] = [
  "PRODUCT_TESTING",
  "SOCIAL_CAMPAIGN",
  "COMMUNITY_ENGAGEMENT",
  "REFERRAL",
  "CONTENT",
  "FEEDBACK",
  "BUG_BOUNTY",
  "OTHER",
];

const PROOF_TYPES: CreateQuestInput["proofType"][] = [
  "TEXT",
  "LINK",
  "SCREENSHOT",
  "TRANSACTION_HASH",
  "REFERRAL_EVENT",
];

export const CATEGORY_LABELS: Record<CreateQuestInput["category"], string> = {
  PRODUCT_TESTING: "Product testing",
  SOCIAL_CAMPAIGN: "Social campaign",
  COMMUNITY_ENGAGEMENT: "Community engagement",
  REFERRAL: "Referral",
  CONTENT: "Content",
  FEEDBACK: "Feedback",
  BUG_BOUNTY: "Bug bounty",
  OTHER: "Other",
};

const CATEGORY_BUTTON_LABELS: Record<CreateQuestInput["category"], string> = {
  PRODUCT_TESTING: "Testing",
  SOCIAL_CAMPAIGN: "Social",
  COMMUNITY_ENGAGEMENT: "Community",
  REFERRAL: "Referral",
  CONTENT: "Content",
  FEEDBACK: "Feedback",
  BUG_BOUNTY: "Bug bounty",
  OTHER: "Other",
};

export const PROOF_TYPE_LABELS: Record<CreateQuestInput["proofType"], string> = {
  TEXT: "Text",
  LINK: "Link",
  SCREENSHOT: "Screenshot",
  TRANSACTION_HASH: "Transaction hash",
  REFERRAL_EVENT: "Referral event",
};

const PROOF_BUTTON_LABELS: Record<CreateQuestInput["proofType"], string> = {
  TEXT: "Text",
  LINK: "Link",
  SCREENSHOT: "Screenshot",
  TRANSACTION_HASH: "Tx hash",
  REFERRAL_EVENT: "Referral",
};

export function categoryKeyboard() {
  const keyboard = new InlineKeyboard();

  for (let index = 0; index < CATEGORIES.length; index += 2) {
    const left = CATEGORIES[index];
    const right = CATEGORIES[index + 1];
    keyboard.text(CATEGORY_BUTTON_LABELS[left], `${QUEST_CATEGORY_CALLBACK_PREFIX}${left}`);
    if (right) {
      keyboard.text(CATEGORY_BUTTON_LABELS[right], `${QUEST_CATEGORY_CALLBACK_PREFIX}${right}`);
    }
    keyboard.row();
  }

  keyboard.text("Cancel", NAV_CANCEL);
  return keyboard;
}

export function proofTypeKeyboard() {
  const keyboard = new InlineKeyboard();

  for (let index = 0; index < PROOF_TYPES.length; index += 2) {
    const left = PROOF_TYPES[index];
    const right = PROOF_TYPES[index + 1];
    keyboard.text(PROOF_BUTTON_LABELS[left], `${QUEST_PROOF_CALLBACK_PREFIX}${left}`);
    if (right) {
      keyboard.text(PROOF_BUTTON_LABELS[right], `${QUEST_PROOF_CALLBACK_PREFIX}${right}`);
    }
    keyboard.row();
  }

  keyboard.text("Cancel", NAV_CANCEL);
  return keyboard;
}

export function confirmQuestKeyboard() {
  return new InlineKeyboard()
    .text("Save Draft", QUEST_CONFIRM_SAVE)
    .row()
    .text("Cancel", QUEST_CONFIRM_CANCEL);
}
