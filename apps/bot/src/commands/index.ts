import type { Bot, CommandContext, Context, SessionFlavor } from "grammy";
import { APP_NAME } from "@nimiqearn/shared";
import { helpCommand } from "./help.js";
import type { SessionData } from "../types.js";

type BotContext = Context & SessionFlavor<SessionData>;

const KNOWN_COMMANDS = new Set(["start", "help"]);

export function registerCommands(bot: Bot<BotContext>) {
  bot.command("help", helpCommand);

  bot.command("start", async (ctx: CommandContext<BotContext>) => {
    await ctx.reply(
      `Welcome to ${APP_NAME}!\n\nOnboarding lands in the next update. Use /help for available commands.`,
    );
  });

  bot.on("message:text").filter((ctx) => {
    const text = ctx.message.text;
    if (!text.startsWith("/")) return false;
    const command = text.slice(1).split(/[\s@]/)[0]?.toLowerCase();
    return command !== undefined && !KNOWN_COMMANDS.has(command);
  }, unknownCommandHandler);
}

async function unknownCommandHandler(ctx: BotContext) {
  await ctx.reply("I don't recognize that command. Try /help to see what's available.");
}
