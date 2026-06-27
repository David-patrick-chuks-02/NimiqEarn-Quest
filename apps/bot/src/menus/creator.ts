import { InlineKeyboard, type Bot } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { mainMenuKeyboard } from "./main.js";
import { hasActiveConversation } from "../utils/conversation.js";
import { formatCreatorDashboard } from "./creator-dashboard.js";
import { creatorQuestListKeyboard, formatCreatorQuestList } from "./quest-list.js";
import { QUEST_PUBLISH_CALLBACK_PREFIX } from "../conversations/quest-keyboards.js";

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

async function sendCreatorQuestList(ctx: BotContext, api: ApiClient) {
  const from = ctx.from;
  if (!from) return;

  const quests = await api.listCreatorQuests(String(from.id));
  const keyboard = creatorQuestListKeyboard(quests);
  keyboard.row().text("Back to dashboard", "creator:back-dashboard");
  keyboard.text("Main Menu", CREATOR_CALLBACKS.backToMenu);

  await ctx.reply(formatCreatorQuestList(quests), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
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

    if (hasActiveConversation(ctx)) {
      await ctx.reply(messages.quest.alreadyInProgress);
      return;
    }

    await ctx.conversation.enter("createQuest");
  });

  bot.callbackQuery(CREATOR_CALLBACKS.myQuests, async (ctx) => {
    await ctx.answerCallbackQuery();

    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    try {
      await sendCreatorQuestList(ctx, api);
    } catch (error) {
      console.error("Creator quest list failed:", error);
      await ctx.reply(messages.quest.listFailed, { reply_markup: creatorHubKeyboard() });
    }
  });

  bot.callbackQuery("creator:back-dashboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendCreatorHub(ctx, api);
  });

  bot.callbackQuery(new RegExp(`^${QUEST_PUBLISH_CALLBACK_PREFIX}`), async (ctx) => {
    await ctx.answerCallbackQuery();

    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    const data = ctx.callbackQuery.data;
    const questId = data?.slice(QUEST_PUBLISH_CALLBACK_PREFIX.length);
    if (!questId) return;

    try {
      const quest = await api.publishQuest(String(from.id), questId);
      await ctx.reply(messages.quest.published(quest.title), { parse_mode: "Markdown" });
      await sendCreatorQuestList(ctx, api);
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "INVALID_STATUS") {
        await ctx.reply(messages.quest.publishNotDraft);
        return;
      }
      if (code === "QUEST_NOT_FOUND") {
        await ctx.reply(messages.quest.publishNotFound);
        return;
      }
      if (code === "INVALID_QUEST") {
        await ctx.reply(messages.quest.publishDeadlinePassed);
        return;
      }
      console.error("Quest publish failed:", error);
      await ctx.reply(messages.quest.publishFailed);
    }
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
