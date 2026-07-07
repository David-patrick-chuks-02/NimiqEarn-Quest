import type { CommandContext } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { renderSettings } from "../menus/settings.js";

export function createSettingsCommand(api: ApiClient) {
  return async function settingsCommand(ctx: CommandContext<BotContext>) {
    try {
      await renderSettings(ctx, api);
    } catch (error) {
      console.error("Settings command failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  };
}
