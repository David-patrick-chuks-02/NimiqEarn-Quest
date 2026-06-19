import { Bot, session, type Context, type SessionFlavor } from "grammy";
import type { BotEnv } from "./config.js";
import { registerCommands } from "./commands/index.js";
import type { Logger } from "./logger.js";
import { loggingMiddleware } from "./middleware/logging.js";
import { createRedisSessionStorage } from "./session.js";
import type { SessionData } from "./types.js";

type BotContext = Context & SessionFlavor<SessionData>;

export function createBot(env: BotEnv, logger: Logger) {
  const bot = new Bot<BotContext>(env.BOT_TOKEN);
  const { redis, storage } = createRedisSessionStorage(env, logger);

  bot.use(loggingMiddleware(logger));
  bot.use(
    session({
      initial: (): SessionData => ({}),
      storage,
    }),
  );

  registerCommands(bot);

  bot.catch((error) => {
    logger.error({ err: error.error ?? error }, "bot error");
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
