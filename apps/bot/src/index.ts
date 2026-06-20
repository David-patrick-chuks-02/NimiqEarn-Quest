import "./env.js";
import { APP_NAME } from "@nimiqearn/shared";
import { createBot } from "./bot.js";
import { isWebhookMode, loadBotEnv } from "./config.js";
import { createLogger } from "./logger.js";
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

  const logger = createLogger(env);
  const { bot } = createBot(env, logger);

  if (isWebhookMode(env)) {
    const { publicUrl } = await startWebhookServer(bot, env, logger);
    logger.info(`[${APP_NAME}] Bot running in webhook mode → ${publicUrl}`);
    return;
  }

  logger.info(`[${APP_NAME}] Starting bot (polling)...`);
  await bot.start();
}

main().catch((error) => {
  console.error("Failed to start bot:", error);
  process.exit(1);
});
