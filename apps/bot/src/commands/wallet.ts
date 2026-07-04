import type { CommandContext } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { renderWalletMenu } from "../menus/wallet.js";

export function createWalletCommand(api: ApiClient) {
  return async function walletCommand(ctx: CommandContext<BotContext>) {
    if (!ctx.from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    try {
      await renderWalletMenu(ctx, api);
    } catch (error) {
      console.error("Wallet command failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  };
}
