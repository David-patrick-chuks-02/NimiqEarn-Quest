import type { NextFunction } from "grammy";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import type { Logger } from "../logger.js";
import { hasActiveConversation } from "../utils/conversation.js";

export function fallbackMiddleware(logger: Logger) {
  return async (ctx: BotContext, next: NextFunction) => {
    await next();

    if (!ctx.message?.text || ctx.message.text.startsWith("/")) return;
    if (hasActiveConversation(ctx)) return;

    logger.info({ userId: ctx.from?.id, text: ctx.message.text }, "unhandled text message");
    await ctx.reply(messages.unknownText);
  };
}
