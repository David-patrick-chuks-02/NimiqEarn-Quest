import type { CommandContext } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import {
  creatorRegisterKeyboard,
  sendCreatorHub,
} from "../menus/creator.js";

function isCreatorRole(role: string) {
  return role === "CREATOR" || role === "ADMIN";
}

export function createCreatorCommand(api: ApiClient) {
  return async function creatorCommand(ctx: CommandContext<BotContext>) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    const telegramId = String(from.id);

    try {
      const user = await api.getUserByTelegramId(telegramId);
      if (!user) {
        await ctx.reply(messages.creator.notRegistered, { parse_mode: "Markdown" });
        return;
      }

      if (isCreatorRole(user.role)) {
        await sendCreatorHub(ctx, api);
        return;
      }

      await ctx.reply(messages.creator.invite, {
        parse_mode: "Markdown",
        reply_markup: creatorRegisterKeyboard(),
      });
    } catch (error) {
      console.error("Creator command failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  };
}
