import { InlineKeyboard, type Bot } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { editOrReply } from "../utils/edit-or-reply.js";
import { openCreatorEntry } from "./creator.js";
import { sendDiscover } from "../commands/quests.js";
import { walletHeader } from "./wallet-summary.js";
import { renderWalletMenu } from "./wallet.js";

export const MAIN_MENU_CALLBACKS = {
  startEarning: "menu:start-earning",
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
  const kb = new InlineKeyboard().text("Start Earning", MAIN_MENU_CALLBACKS.startEarning).row();

  // Richer visual browse in the Mini App (in addition to the native Start Earning list).
  const earnUrl = earnMiniAppUrl();
  if (earnUrl) kb.webApp("Browse quests", earnUrl).row();

  return kb
    .text("My Wallet", MAIN_MENU_CALLBACKS.wallet)
    .text("Creator Hub", MAIN_MENU_CALLBACKS.creator)
    .row()
    .text("Refresh", MAIN_MENU_CALLBACKS.refresh)
    .text("Settings", "settings:open")
    .row()
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

async function lookupUser(ctx: BotContext, api: ApiClient) {
  const from = ctx.from;
  if (!from) return null;
  return api.getUserByTelegramId(String(from.id));
}

export function registerMainMenuHandlers(bot: Bot<BotContext>, api: ApiClient) {
  // Start Earning → browse open quests (the worker discovery list).
  bot.callbackQuery(MAIN_MENU_CALLBACKS.startEarning, async (ctx) => {
    await ctx.answerCallbackQuery();

    try {
      const user = await lookupUser(ctx, api);
      if (!user) {
        await ctx.reply(messages.menu.notRegistered, { parse_mode: "Markdown" });
        return;
      }
      await sendDiscover(ctx, api, 0);
    } catch (error) {
      console.error("Start earning failed:", error);
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
