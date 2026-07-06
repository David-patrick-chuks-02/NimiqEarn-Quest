import { GrammyError, type InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";

interface EditOrReplyOptions {
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
  reply_markup?: InlineKeyboard;
}

/**
 * Update the message a callback came from instead of sending a new one — this keeps
 * button-driven navigation on a single, in-place message rather than spamming the chat.
 *
 * - Callback context → edit the existing message.
 * - "Message is not modified" → treated as success (no-op), never a duplicate reply.
 * - Not editable (too old, or a plain command with no source message) → fresh reply.
 */
export async function editOrReply(ctx: BotContext, text: string, options?: EditOrReplyOptions) {
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, options);
      return;
    } catch (error) {
      if (
        error instanceof GrammyError &&
        error.description.includes("message is not modified")
      ) {
        return;
      }
      // Otherwise fall through and send a new message (e.g. the original is too old to edit).
    }
  }

  await ctx.reply(text, options);
}
