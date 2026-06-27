import { InlineKeyboard } from "grammy";
import { CREATOR_CALLBACKS } from "./creator.js";

export const NAV_CANCEL = "nav:cancel";

export function cancelStepKeyboard() {
  return new InlineKeyboard().text("Cancel", NAV_CANCEL);
}

export function afterQuestSavedKeyboard() {
  return new InlineKeyboard()
    .text("Publish Now", CREATOR_CALLBACKS.myQuests)
    .text("Create Another", CREATOR_CALLBACKS.createQuest)
    .row()
    .text("Creator Hub", "creator:back-dashboard")
    .text("Main Menu", CREATOR_CALLBACKS.backToMenu);
}

export function afterWalletKeyboard() {
  return new InlineKeyboard()
    .text("Creator Hub", "creator:back-dashboard")
    .text("Main Menu", CREATOR_CALLBACKS.backToMenu);
}
