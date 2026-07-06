import type { CommandContext } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { sendMainMenu } from "../menus/main.js";

export function createMenuCommand(api: ApiClient) {
  return async function menuCommand(ctx: CommandContext<BotContext>) {
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

      const name = user.displayName ?? from.first_name ?? "worker";
      await sendMainMenu(ctx, api, messages.menu.greeting(name));
    } catch (error) {
      console.error("Menu lookup failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  };
}
