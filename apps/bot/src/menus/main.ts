import { InlineKeyboard, type Bot } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { editOrReply } from "../utils/edit-or-reply.js";
import { openCreatorEntry } from "./creator.js";
import { sendBrowsePrompt } from "../commands/quests.js";
import { sendEarnings } from "./earnings.js";
import { walletHeader } from "./wallet-summary.js";
import { renderWalletMenu } from "./wallet.js";

export const MAIN_MENU_CALLBACKS = {
  startEarning: "menu:start-earning",
  earnings: "menu:earnings",
  wallet: "menu:wallet",
  creator: "menu:creator",
  refresh: "menu:refresh",
  help: "menu:help",
} as const;

/** Worker "Browse & Earn" Mini App URL — web_app buttons require HTTPS. */
function earnMiniAppUrl(): string | null {
  const base = (process.env.WEB_PUBLIC_URL ?? "").replace(/\/$/, "");
  return base.startsWith("https://") ? `${base}/earn` : null;
}

export function mainMenuKeyboard() {
  const kb = new InlineKeyboard();

  // One browse entry: the rich Mini App over HTTPS, else the native bot list (dev fallback).
  const earnUrl = earnMiniAppUrl();
  if (earnUrl) kb.webApp("Start Earning", earnUrl);
  else kb.text("Start Earning", MAIN_MENU_CALLBACKS.startEarning);
  kb.text("My Earnings", MAIN_MENU_CALLBACKS.earnings).row();

  return kb
    .text("My Wallet", MAIN_MENU_CALLBACKS.wallet)
    .text("Creator Hub", MAIN_MENU_CALLBACKS.creator)
    .row()
    .text("Refresh", MAIN_MENU_CALLBACKS.refresh)
    .text("Settings", "settings:open")
    .text("Help", MAIN_MENU_CALLBACKS.help);
}

export async function sendMainMenu(ctx: BotContext, api: ApiClient, greeting: string) {
  // Show the wallet balance + address at the top of the menu.
  const header = ctx.from ? await walletHeader(api, String(ctx.from.id)) : "";
  // Edits the current message when reached via a button (single-message navigation);
  // replies fresh for /start and /menu.
  await editOrReply(ctx, header + greeting, {
    parse_mode: "Markdown",
    reply_markup: mainMenuKeyboard(),
  });
}


export function registerMainMenuHandlers(bot: Bot<BotContext>, api: ApiClient) {
  // Backward-compat: old in-chat quest-list buttons (discover:page:*) now open the browse
  // Mini App instead of dead-ending.
  bot.callbackQuery(/^discover:page:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendBrowsePrompt(ctx).catch(() => undefined);
  });

  // Start Earning → open the quest Mini App (over HTTPS the button opens it directly; this
  // callback is only hit on the non-HTTPS dev fallback).
  bot.callbackQuery(MAIN_MENU_CALLBACKS.startEarning, async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await sendBrowsePrompt(ctx);
    } catch (error) {
      console.error("Start earning failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  });

  bot.callbackQuery(MAIN_MENU_CALLBACKS.earnings, async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await sendEarnings(ctx, api);
    } catch (error) {
      console.error("My Earnings failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  });

  bot.callbackQuery(MAIN_MENU_CALLBACKS.wallet, async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await renderWalletMenu(ctx, api);
    } catch (error) {
      console.error("Wallet menu from main menu failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  });

  bot.callbackQuery(MAIN_MENU_CALLBACKS.creator, async (ctx) => {
    await ctx.answerCallbackQuery();

    try {
      await openCreatorEntry(ctx, api);
    } catch (error) {
      console.error("Creator hub from menu failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  });

  // Refresh the main menu (re-fetches the wallet balance).
  bot.callbackQuery(MAIN_MENU_CALLBACKS.refresh, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Refreshing balance…" });
    const name = ctx.from?.first_name ?? "there";
    try {
      await sendMainMenu(ctx, api, messages.menu.greeting(name));
    } catch (error) {
      console.error("Main menu refresh failed:", error);
    }
  });

  bot.callbackQuery(MAIN_MENU_CALLBACKS.help, async (ctx) => {
    await ctx.answerCallbackQuery();
    // Show help in place with the menu keyboard, instead of stacking two new messages.
    await editOrReply(ctx, messages.help(ctx.me?.username), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });
}
