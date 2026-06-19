import type { CommandContext } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { sendMainMenu } from "../menus/main.js";

export function createStartCommand(api: ApiClient) {
  return async function startCommand(ctx: CommandContext<BotContext>) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply("Could not read your Telegram profile. Please try again.");
      return;
    }

    const telegramId = String(from.id);

    try {
      const existing = await api.getUserByTelegramId(telegramId);
      if (existing) {
        const name = existing.displayName ?? "worker";
        await sendMainMenu(ctx, `Welcome back, ${name}! Choose an option below.`);
        return;
      }
    } catch (error) {
      console.error("Start lookup failed:", error);
      await ctx.reply("Could not reach the server right now. Please try /start again shortly.");
      return;
    }

    await ctx.conversation.enter("onboarding");
  };
}
