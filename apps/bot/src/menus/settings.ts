import { InlineKeyboard, type Bot } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { editOrReply } from "../utils/edit-or-reply.js";
import { hasActiveConversation } from "../utils/conversation.js";
import { CREATOR_CALLBACKS } from "./creator.js";

export const SETTINGS_CALLBACKS = {
  open: "settings:open",
  setPassword: "settings:set-pw",
  changePassword: "settings:change-pw",
  removePassword: "settings:remove-pw",
  backupKey: "settings:backup-key",
} as const;

export async function renderSettings(ctx: BotContext, api: ApiClient) {
  const from = ctx.from;
  if (!from) {
    await ctx.reply(messages.errors.noTelegramProfile);
    return;
  }

  const { passwordSet } = await api.getSecurityStatus(String(from.id));
  const keyboard = new InlineKeyboard();
  if (passwordSet) {
    keyboard
      .text("Change action password", SETTINGS_CALLBACKS.changePassword)
      .row()
      .text("Remove action password", SETTINGS_CALLBACKS.removePassword)
      .row();
  } else {
    keyboard.text("Set action password", SETTINGS_CALLBACKS.setPassword).row();
  }
  keyboard.text("Back up private key", SETTINGS_CALLBACKS.backupKey).row();
  keyboard.text("Main Menu", CREATOR_CALLBACKS.backToMenu);

  await editOrReply(ctx, messages.settings.menu(passwordSet), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

export function registerSettingsHandlers(bot: Bot<BotContext>, api: ApiClient) {
  bot.callbackQuery(SETTINGS_CALLBACKS.open, async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await renderSettings(ctx, api);
    } catch (error) {
      console.error("Settings menu failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  });

  const enterPasswordFlow = (intent: "set" | "change" | "remove") => async (ctx: BotContext) => {
    await ctx.answerCallbackQuery();
    if (hasActiveConversation(ctx)) {
      await ctx.reply(messages.errors.rateLimited);
      return;
    }
    ctx.session.securityIntent = intent;
    await ctx.conversation.enter("securityPassword");
  };

  bot.callbackQuery(SETTINGS_CALLBACKS.setPassword, enterPasswordFlow("set"));
  bot.callbackQuery(SETTINGS_CALLBACKS.changePassword, enterPasswordFlow("change"));
  bot.callbackQuery(SETTINGS_CALLBACKS.removePassword, enterPasswordFlow("remove"));

  bot.callbackQuery(SETTINGS_CALLBACKS.backupKey, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (hasActiveConversation(ctx)) {
      await ctx.reply(messages.errors.rateLimited);
      return;
    }
    await ctx.conversation.enter("backupKey");
  });
}
