import type { Bot, CommandContext } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { editOrReply } from "../utils/edit-or-reply.js";
import { DISCOVER_PAGE_PREFIX, discoverKeyboard, formatDiscoverList } from "../menus/discover.js";

const DISCOVER_PAGE_SIZE = 5;

/** Fetch a page of open quests and render (edit in place when reached via pagination). */
export async function sendDiscover(ctx: BotContext, api: ApiClient, page: number) {
  const list = await api.discoverQuests({ page, pageSize: DISCOVER_PAGE_SIZE });
  await editOrReply(ctx, formatDiscoverList(list), {
    parse_mode: "Markdown",
    reply_markup: discoverKeyboard(list),
  });
}

/** /quests — worker quest discovery: browse open quests and open one to earn (Milestone 2). */
export function createQuestsCommand(api: ApiClient) {
  return async function questsCommand(ctx: CommandContext<BotContext>) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }
    try {
      const user = await api.getUserByTelegramId(String(from.id));
      if (!user) {
        await ctx.reply(messages.menu.notRegistered, { parse_mode: "Markdown" });
        return;
      }
      await sendDiscover(ctx, api, 0);
    } catch (error) {
      console.error("Quests command failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  };
}

/** Pagination for the browse list. */
export function registerDiscoverHandlers(bot: Bot<BotContext>, api: ApiClient) {
  bot.callbackQuery(new RegExp(`^${DISCOVER_PAGE_PREFIX}`), async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = Number(ctx.callbackQuery.data?.slice(DISCOVER_PAGE_PREFIX.length)) || 0;
    try {
      await sendDiscover(ctx, api, page);
    } catch (error) {
      console.error("Quest discovery pagination failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  });
}
