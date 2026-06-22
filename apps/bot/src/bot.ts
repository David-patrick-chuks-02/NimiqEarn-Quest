import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { createApiClient } from "./api/client.js";
import type { BotEnv } from "./config.js";
import { registerCommands } from "./commands/index.js";
import type { BotContext } from "./context.js";
import { createOnboardingConversation } from "./conversations/onboarding.js";
import type { Logger } from "./logger.js";
import { fallbackMiddleware } from "./middleware/fallback.js";
import { loggingMiddleware } from "./middleware/logging.js";
import { registerMainMenuHandlers } from "./menus/main.js";
import { messages } from "./copy/messages.js";
import { createRedisSessionStorage } from "./session.js";
import type { SessionData } from "./types.js";

export function createBot(env: BotEnv, logger: Logger) {
  const bot = new Bot<BotContext>(env.BOT_TOKEN);
  const api = createApiClient(env.API_URL);
  const { redis, storage } = createRedisSessionStorage(env, logger);

  bot.use(loggingMiddleware(logger));
  bot.use(
    session({
      initial: (): SessionData => ({}),
      storage,
    }),
  );
  bot.use(conversations());
  bot.use(createConversation(createOnboardingConversation(api), "onboarding"));

  registerCommands(bot, api);
  registerMainMenuHandlers(bot, api);
  bot.use(fallbackMiddleware(logger));

  bot.catch((error) => {
    logger.error({ err: error.error ?? error }, "bot error");
    error.ctx?.reply(messages.errors.generic).catch(() => undefined);
  });

  const shutdown = async () => {
    logger.info("Shutting down bot...");
    await bot.stop();
    redis.disconnect();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return { bot, shutdown };
}
