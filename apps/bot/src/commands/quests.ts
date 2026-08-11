import type { CommandContext } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { sendBrowseQuests } from "../menus/browse.js";

/** /quests — categorized in-chat browse (+ Mini App marketplace). */
export function createQuestsCommand(api: ApiClient) {
  return async function questsCommand(ctx: CommandContext<BotContext>) {
    if (!ctx.from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }
    try {
      await sendBrowseQuests(ctx, api);
    } catch (error) {
      console.error("/quests browse failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  };
}
