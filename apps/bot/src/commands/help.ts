import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";

export async function helpCommand(ctx: BotContext) {
  const botUsername = ctx.me?.username;
  await ctx.reply(messages.help(botUsername), { parse_mode: "Markdown" });
}
