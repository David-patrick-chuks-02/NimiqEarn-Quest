import { InlineKeyboard, type Bot } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { helpCommand } from "../commands/help.js";
import { formatWorkerStatus } from "./worker-status.js";

export const MAIN_MENU_CALLBACKS = {
  startEarning: "menu:start-earning",
  wallet: "menu:wallet",
  help: "menu:help",
} as const;

export function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text("Start Earning", MAIN_MENU_CALLBACKS.startEarning)
    .row()
    .text("My Wallet", MAIN_MENU_CALLBACKS.wallet)
    .text("Help", MAIN_MENU_CALLBACKS.help);
}

export async function sendMainMenu(ctx: BotContext, greeting: string) {
  await ctx.reply(greeting, {
    parse_mode: "Markdown",
    reply_markup: mainMenuKeyboard(),
  });
}

async function lookupUser(ctx: BotContext, api: ApiClient) {
  const from = ctx.from;
  if (!from) return null;
  return api.getUserByTelegramId(String(from.id));
}

export function registerMainMenuHandlers(bot: Bot<BotContext>, api: ApiClient) {
  bot.callbackQuery(MAIN_MENU_CALLBACKS.startEarning, async (ctx) => {
    await ctx.answerCallbackQuery();

    try {
      const user = await lookupUser(ctx, api);
      if (!user) {
        await ctx.reply(messages.menu.notRegistered, { parse_mode: "Markdown" });
        return;
      }

      await ctx.reply(formatWorkerStatus(user), {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
    } catch (error) {
      console.error("Start earning status failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  });

  bot.callbackQuery(MAIN_MENU_CALLBACKS.wallet, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(messages.walletComingSoon, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.callbackQuery(MAIN_MENU_CALLBACKS.help, async (ctx) => {
    await ctx.answerCallbackQuery();
    await helpCommand(ctx);
    await ctx.reply("Need the menu again?", { reply_markup: mainMenuKeyboard() });
  });
}
