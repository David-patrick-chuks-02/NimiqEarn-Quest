import type { Bot } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { helpCommand } from "./help.js";
import { createMenuCommand } from "./menu.js";
import { createStartCommand } from "./start.js";
import { createWalletCommand } from "./wallet.js";

const KNOWN_COMMANDS = new Set(["start", "help", "menu", "wallet"]);

export function registerCommands(bot: Bot<BotContext>, api: ApiClient) {
  bot.command("help", helpCommand);
  bot.command("menu", createMenuCommand(api));
  bot.command("wallet", createWalletCommand());
  bot.command("start", createStartCommand(api));

  bot.on("message:text").filter((ctx) => {
    const text = ctx.message.text;
    if (!text.startsWith("/")) return false;
    const command = text.slice(1).split(/[\s@]/)[0]?.toLowerCase();
    return command !== undefined && !KNOWN_COMMANDS.has(command);
  }, unknownCommandHandler);
}

async function unknownCommandHandler(ctx: BotContext) {
  await ctx.reply(messages.unknownCommand);
}
