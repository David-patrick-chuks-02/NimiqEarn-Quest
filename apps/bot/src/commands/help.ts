import { APP_NAME } from "@nimiqearn/shared";
import type { BotContext } from "../context.js";

export async function helpCommand(ctx: BotContext) {
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
