import "./env.js";
import { APP_NAME } from "@nimiqearn/shared";
import { captureException, flushSentry, initSentry } from "@nimiqearn/observability";
import { createBot } from "./bot.js";
import { isWebhookMode, loadBotEnv } from "./config.js";
import { createLogger } from "./logger.js";
import { configureBotProfile } from "./setup/bot-profile.js";
import { startWebhookServer } from "./webhook.js";

async function main() {
  let env;
  try {
    env = loadBotEnv();
  } catch {
    console.warn(
      `[${APP_NAME}] Bot config invalid or missing — set BOT_TOKEN and REDIS_URL in .env (Day 3+).`,
    );
    process.exit(0);
  }

  // Error monitoring — no-op unless SENTRY_DSN is set (dev, tests, and CI stay clean).
  initSentry({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    serverName: "nimiqearn-bot",
  });

  const logger = createLogger(env);
  const { bot } = createBot(env, logger);

  try {
    await configureBotProfile(bot, logger);
  } catch (error) {
    logger.warn({ err: error }, "Could not update Telegram bot profile");
  }

  if (isWebhookMode(env)) {
    const { publicUrl } = await startWebhookServer(bot, env, logger);
    logger.info(`[${APP_NAME}] Bot running in webhook mode → ${publicUrl}`);
    return;
  }

  logger.info(`[${APP_NAME}] Starting bot (polling)...`);
  await bot.start();
}

main().catch(async (error) => {
  console.error("Failed to start bot:", error);
  captureException(error, { phase: "startup" });
  await flushSentry();
  process.exit(1);
});
