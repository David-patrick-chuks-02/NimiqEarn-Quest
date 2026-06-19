import "dotenv/config";
import { Bot } from "grammy";
import { APP_NAME } from "@nimiqearn/shared";

const token = process.env.BOT_TOKEN;

if (!token) {
  console.warn(
    `[${APP_NAME}] BOT_TOKEN not set — bot scaffold only. Add BOT_TOKEN to .env (Day 3+).`,
  );
  process.exit(0);
}

const bot = new Bot(token);

bot.command("start", async (ctx) => {
  await ctx.reply(
    `Welcome to ${APP_NAME}!\n\nBot foundation lands on Day 3–4. Full onboarding coming soon.`,
  );
});

bot.catch((error) => {
  console.error("Bot error:", error);
});

console.log(`[${APP_NAME}] Starting bot (polling)...`);
bot.start();
