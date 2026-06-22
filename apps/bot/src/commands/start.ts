import type { CommandContext } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { sendMainMenu } from "../menus/main.js";
import { hasActiveConversation } from "../utils/conversation.js";

export function createStartCommand(api: ApiClient) {
  return async function startCommand(ctx: CommandContext<BotContext>) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    const telegramId = String(from.id);

    if (hasActiveConversation(ctx)) {
      await ctx.reply(messages.onboarding.alreadyInProgress);
      return;
    }

    try {
      const existing = await api.getUserByTelegramId(telegramId);
      if (existing) {
        const name = existing.displayName ?? from.first_name ?? "worker";
        await sendMainMenu(ctx, messages.menu.greeting(name));
        return;
      }
    } catch (error) {
      console.error("Start lookup failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
      return;
    }

    await ctx.conversation.enter("onboarding");
  };
}
