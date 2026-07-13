import { InlineKeyboard, type CommandContext } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { editOrReply } from "../utils/edit-or-reply.js";

/** Worker "Browse & Earn" Mini App URL — web_app buttons require HTTPS. */
function earnMiniAppUrl(): string | null {
  const base = (process.env.WEB_PUBLIC_URL ?? "").replace(/\/$/, "");
  return base.startsWith("https://") ? `${base}/earn` : null;
}

/** Prompt that opens the quest-browsing Mini App (no quest list is shown in chat). */
export async function sendBrowsePrompt(ctx: BotContext) {
  const url = earnMiniAppUrl();
  if (!url) {
    await ctx.reply(messages.quests.miniAppOnly);
    return;
  }
  await editOrReply(ctx, messages.quests.browsePrompt, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard().webApp("Browse quests", url),
  });
}

/** /quests — opens the worker discovery Mini App. */
export function createQuestsCommand(_api: ApiClient) {
  return async function questsCommand(ctx: CommandContext<BotContext>) {
    if (!ctx.from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }
    await sendBrowsePrompt(ctx);
  };
}
