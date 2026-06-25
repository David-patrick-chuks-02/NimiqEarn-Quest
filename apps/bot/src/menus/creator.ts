import { InlineKeyboard, type Bot } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { mainMenuKeyboard } from "./main.js";
import { formatCreatorDashboard } from "./creator-dashboard.js";

export const CREATOR_CALLBACKS = {
  register: "creator:register",
  createQuest: "creator:create-quest",
  myQuests: "creator:my-quests",
  backToMenu: "creator:back-menu",
} as const;

export function creatorHubKeyboard() {
  return new InlineKeyboard()
    .text("Create Quest", CREATOR_CALLBACKS.createQuest)
    .row()
    .text("My Quests", CREATOR_CALLBACKS.myQuests)
    .text("Main Menu", CREATOR_CALLBACKS.backToMenu);
}

export function creatorRegisterKeyboard() {
  return new InlineKeyboard().text("Become a Creator", CREATOR_CALLBACKS.register);
}

export async function sendCreatorHub(ctx: BotContext, api: ApiClient) {
  const from = ctx.from;
  if (!from) return;

  const dashboard = await api.getCreatorDashboard(String(from.id));
  await ctx.reply(formatCreatorDashboard(dashboard), {
    parse_mode: "Markdown",
    reply_markup: creatorHubKeyboard(),
  });
}

export function registerCreatorHandlers(bot: Bot<BotContext>, api: ApiClient) {
  bot.callbackQuery(CREATOR_CALLBACKS.register, async (ctx) => {
    await ctx.answerCallbackQuery();

    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    try {
      await api.registerCreator(String(from.id));
      await ctx.reply(messages.creator.welcome, { parse_mode: "Markdown" });
      await sendCreatorHub(ctx, api);
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "SUSPENDED") {
        await ctx.reply(messages.creator.suspended);
        return;
      }
      console.error("Creator registration failed:", error);
      await ctx.reply(messages.creator.registerFailed);
    }
  });

  bot.callbackQuery(CREATOR_CALLBACKS.createQuest, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(messages.creator.createQuestSoon, {
      parse_mode: "Markdown",
      reply_markup: creatorHubKeyboard(),
    });
  });

  bot.callbackQuery(CREATOR_CALLBACKS.myQuests, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(messages.creator.myQuestsSoon, {
      parse_mode: "Markdown",
      reply_markup: creatorHubKeyboard(),
    });
  });

  bot.callbackQuery(CREATOR_CALLBACKS.backToMenu, async (ctx) => {
    await ctx.answerCallbackQuery();
    const name = ctx.from?.first_name ?? "there";
    await ctx.reply(messages.menu.greeting(name), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });
}
