import type { NextFunction } from "grammy";
import type { BotContext } from "../context.js";
import type { Logger } from "../logger.js";

export function loggingMiddleware(logger: Logger) {
  return async (ctx: BotContext, next: NextFunction) => {
    const started = Date.now();
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const text =
      ctx.message?.text ??
      ctx.callbackQuery?.data ??
      ctx.update.callback_query?.data ??
      "non-text-update";

    try {
      await next();
      logger.info(
        { userId, username, text, durationMs: Date.now() - started },
        "update handled",
      );
    } catch (error) {
      logger.error(
        { userId, username, text, err: error, durationMs: Date.now() - started },
        "update failed",
      );
      throw error;
    }
  };
}
