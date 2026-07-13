import type { NextFunction } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import type { Logger } from "../logger.js";
import { sendMainMenu } from "../menus/main.js";
import { hasActiveConversation } from "../utils/conversation.js";

export function fallbackMiddleware(logger: Logger, api: ApiClient) {
  return async (ctx: BotContext, next: NextFunction) => {
    await next();

    // An unmatched callback query = a button whose handler no longer exists (a feature that
    // moved, an old message, or a past bot version). Rather than a dead-end, open a fresh main
    // menu in place so the tap always lands somewhere useful.
    if (ctx.callbackQuery) {
      logger.info(
        { userId: ctx.from?.id, data: ctx.callbackQuery.data },
        "unhandled callback -> main menu",
      );
      await ctx.answerCallbackQuery().catch(() => undefined);
      try {
        const name = ctx.from?.first_name ?? "there";
        await sendMainMenu(ctx, api, messages.menu.greeting(name));
      } catch (error) {
        logger.error({ err: error }, "fallback menu render failed");
      }
      return;
    }

    if (!ctx.message?.text || ctx.message.text.startsWith("/")) return;
    if (hasActiveConversation(ctx)) return;

    logger.info({ userId: ctx.from?.id, text: ctx.message.text }, "unhandled text message");
    await ctx.reply(messages.unknownText);
  };
}
