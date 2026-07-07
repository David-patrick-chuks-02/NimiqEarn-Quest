import type { NextFunction } from "grammy";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import type { Logger } from "../logger.js";
import type { RateLimiter } from "../utils/rate-limit.js";
import { CREATOR_CALLBACKS } from "../menus/creator.js";
import { WALLET_CALLBACKS } from "../menus/wallet.js";
import { QUEST_EDIT_CALLBACK_PREFIX } from "../conversations/quest-keyboards.js";

const LIMIT = 5;
const WINDOW_SEC = 60;

/**
 * Detects entry into a sensitive flow: creating a wallet, revealing/exporting the private
 * key, or creating/editing a quest. Steps inside an active conversation are consumed by the
 * conversations plugin before this middleware runs, so only entry points are throttled.
 * (Opening the wallet or quest menus is not throttled — only the sensitive actions are.)
 */
function isSensitive(ctx: BotContext): boolean {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;
  return (
    data === WALLET_CALLBACKS.create ||
    data === WALLET_CALLBACKS.withdraw ||
    data === CREATOR_CALLBACKS.createQuest ||
    data.startsWith(QUEST_EDIT_CALLBACK_PREFIX)
  );
}

export function rateLimitMiddleware(limiter: RateLimiter, logger: Logger) {
  return async (ctx: BotContext, next: NextFunction) => {
    if (!ctx.from || !isSensitive(ctx)) {
      return next();
    }

    const result = await limiter(`sensitive:${ctx.from.id}`, LIMIT, WINDOW_SEC).catch((err) => {
      logger.error({ err }, "rate limiter error");
      return { allowed: true, retryAfterSec: 0 };
    });

    if (!result.allowed) {
      logger.warn({ userId: ctx.from.id }, "rate limit hit on sensitive flow");
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: messages.errors.rateLimited });
      } else {
        await ctx.reply(messages.errors.rateLimited);
      }
      return;
    }

    return next();
  };
}
