import type { NextFunction } from "grammy";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import type { Logger } from "../logger.js";
import { hasActiveConversation } from "../utils/conversation.js";

export function fallbackMiddleware(logger: Logger) {
  return async (ctx: BotContext, next: NextFunction) => {
    await next();

    // An unmatched callback query means a stale/expired inline button (tapped on an old
    // message, or after the flow that owned it ended). No handler answered it, so answer it
    // here — otherwise Telegram's loading spinner hangs and the button appears to do nothing.
    if (ctx.callbackQuery) {
      logger.info(
        { userId: ctx.from?.id, data: ctx.callbackQuery.data },
        "unhandled callback query",
      );
      await ctx.answerCallbackQuery({ text: messages.errors.buttonExpired }).catch(() => undefined);
      return;
    }

    if (!ctx.message?.text || ctx.message.text.startsWith("/")) return;
    if (hasActiveConversation(ctx)) return;

    logger.info({ userId: ctx.from?.id, text: ctx.message.text }, "unhandled text message");
    await ctx.reply(messages.unknownText);
  };
}
