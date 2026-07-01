import type { CommandContext } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { creatorHubKeyboard } from "../menus/creator.js";
import { mainMenuKeyboard } from "../menus/main.js";

function isCreatorRole(role: string) {
  return role === "CREATOR" || role === "ADMIN";
}

/**
 * Milestone 1 stub for /quests. Worker quest discovery lands in Milestone 2;
 * creators are pointed at their own quest management.
 */
export function createQuestsCommand(api: ApiClient) {
  return async function questsCommand(ctx: CommandContext<BotContext>) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    try {
      const user = await api.getUserByTelegramId(String(from.id));
      if (!user) {
        await ctx.reply(messages.menu.notRegistered, { parse_mode: "Markdown" });
        return;
      }

      if (isCreatorRole(user.role)) {
        await ctx.reply(messages.quests.creatorHint, {
          parse_mode: "Markdown",
          reply_markup: creatorHubKeyboard(),
        });
        return;
      }

      await ctx.reply(messages.quests.comingSoon, {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
    } catch (error) {
      console.error("Quests command failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  };
}
