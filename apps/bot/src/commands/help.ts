import type { CommandContext, Context, SessionFlavor } from "grammy";
import { APP_NAME } from "@nimiqearn/shared";
import type { SessionData } from "../types.js";

type BotContext = Context & SessionFlavor<SessionData>;

export async function helpCommand(ctx: CommandContext<BotContext>) {
  await ctx.reply(
    [
      `*${APP_NAME} — Help*`,
      "",
      "Available commands:",
      "/start — Get started or return to the main menu",
      "/help — Show this message",
      "",
      "*Responsible earning*",
      "Complete tasks honestly and submit genuine proof. Fake submissions may lead to suspension.",
      "",
      "Questions? Reach out to the NimiqEarn Quest team on the Nimiq forum.",
    ].join("\n"),
    { parse_mode: "Markdown" },
  );
}
