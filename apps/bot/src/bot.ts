import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { captureException } from "@nimiqearn/observability";
import { createApiClient } from "./api/client.js";
import type { BotEnv } from "./config.js";
import { registerCommands } from "./commands/index.js";
import type { BotContext } from "./context.js";
import { createOnboardingConversation } from "./conversations/onboarding.js";
import { createLinkWalletConversation } from "./conversations/link-wallet.js";
import { createQuestConversation } from "./conversations/create-quest.js";
import { createEditQuestConversation } from "./conversations/edit-quest.js";
import type { Logger } from "./logger.js";
import { fallbackMiddleware } from "./middleware/fallback.js";
import { loggingMiddleware } from "./middleware/logging.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { createRateLimiter } from "./utils/rate-limit.js";
import { registerCreatorHandlers } from "./menus/creator.js";
import { registerMainMenuHandlers } from "./menus/main.js";
import { registerWalletHandlers } from "./menus/wallet.js";
import { messages } from "./copy/messages.js";
import { createRedisSessionStorage } from "./session.js";
import type { SessionData } from "./types.js";

export function createBot(env: BotEnv, logger: Logger) {
  const bot = new Bot<BotContext>(env.BOT_TOKEN);
  const api = createApiClient(env.API_URL, env.API_SHARED_SECRET);
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
  bot.use(createConversation(createLinkWalletConversation(api), "linkWallet"));
  bot.use(createConversation(createQuestConversation(api), "createQuest"));
  bot.use(createConversation(createEditQuestConversation(api), "editQuest"));

  // Throttle sensitive flow entries (wallet linking, quest creation/editing).
  // Placed after conversations() so in-flow steps are consumed before this runs.
  bot.use(rateLimitMiddleware(createRateLimiter(redis), logger));

  registerCommands(bot, api);
  registerMainMenuHandlers(bot, api);
  registerWalletHandlers(bot, api, env.WEB_PUBLIC_URL);
  registerCreatorHandlers(bot, api);
  bot.use(fallbackMiddleware(logger));

  bot.catch((error) => {
    logger.error({ err: error.error ?? error }, "bot error");
    captureException(error.error ?? error, {
      updateId: error.ctx?.update.update_id,
      from: error.ctx?.from?.id,
    });
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
