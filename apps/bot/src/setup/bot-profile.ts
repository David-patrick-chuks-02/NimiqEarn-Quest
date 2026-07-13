import type { Bot } from "grammy";
import type { BotContext } from "../context.js";
import type { Logger } from "../logger.js";

// NOTE: the bot's profile photo (avatar) cannot be set via the Bot API — there is no
// setMyPhoto method. Set it once through @BotFather → /setuserpic, uploading the
// square, circular-crop-safe logo at `assets/bot-avatar.png` (640×640).

export const BOT_COMMANDS = [
  { command: "start", description: "Create your profile or open the main menu" },
  { command: "menu", description: "Open the main menu" },
  { command: "wallet", description: "Link or update your Nimiq payout address" },
  { command: "quests", description: "Browse open quests and earn NIM" },
  { command: "creator", description: "Open the Creator Hub" },
  { command: "settings", description: "Language and security settings" },
  { command: "help", description: "View commands and guidelines" },
] as const;

export const BOT_DESCRIPTION = [
  "NimiqEarn Quest is a Telegram-native marketplace for paid tasks and bounties in the Nimiq ecosystem.",
  "",
  "Workers complete quests and earn NIM rewards.",
  "Creators publish quests with defined rewards, slots, and proof requirements.",
  "",
  "Send /start to create your profile and open the main menu.",
].join("\n");

export const BOT_SHORT_DESCRIPTION =
  "Complete quests in Telegram and earn NIM rewards in the Nimiq ecosystem.";

export async function configureBotProfile(bot: Bot<BotContext>, logger: Logger) {
  await bot.api.setMyCommands(BOT_COMMANDS.map(({ command, description }) => ({ command, description })));
  await bot.api.setMyDescription(BOT_DESCRIPTION);
  await bot.api.setMyShortDescription(BOT_SHORT_DESCRIPTION);
  logger.info("Telegram bot profile updated (commands, description, short description)");
}
