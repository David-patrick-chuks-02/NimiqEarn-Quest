import type { CommandContext } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { openCreatorEntry } from "../menus/creator.js";

export function createCreatorCommand(api: ApiClient) {
  return async function creatorCommand(ctx: CommandContext<BotContext>) {
    try {
      await openCreatorEntry(ctx, api);
    } catch (error) {
      console.error("Creator command failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  };
}
