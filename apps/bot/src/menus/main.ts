import { InlineKeyboard, type Bot } from "grammy";
import type { BotContext } from "../context.js";
import { helpCommand } from "../commands/help.js";

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
  await ctx.reply(greeting, { reply_markup: mainMenuKeyboard() });
}

export function registerMainMenuHandlers(bot: Bot<BotContext>) {
  bot.callbackQuery(MAIN_MENU_CALLBACKS.startEarning, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "Quest browsing lands soon. For now, make sure your profile is set up with /start.",
    );
  });

  bot.callbackQuery(MAIN_MENU_CALLBACKS.wallet, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "Wallet linking is coming in Week 2. You'll connect your Nimiq address to receive rewards.",
    );
  });

  bot.callbackQuery(MAIN_MENU_CALLBACKS.help, async (ctx) => {
    await ctx.answerCallbackQuery();
    await helpCommand(ctx);
  });
}
