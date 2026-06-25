import type { CommandContext } from "grammy";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { hasActiveConversation } from "../utils/conversation.js";

export function createWalletCommand() {
  return async function walletCommand(ctx: CommandContext<BotContext>) {
    if (!ctx.from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    if (hasActiveConversation(ctx)) {
      await ctx.reply(messages.wallet.alreadyInProgress);
      return;
    }

    await ctx.conversation.enter("wallet");
  };
}
