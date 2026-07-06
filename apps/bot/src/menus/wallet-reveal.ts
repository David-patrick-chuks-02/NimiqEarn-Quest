import { InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";

export const WALLET_REVEAL_DISMISS = "wallet:dismiss";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Show a custodial wallet's address + private key ONCE. The key is spoiler-blurred (tap to
 * reveal) and the message carries a delete button — the user taps it after saving, and the
 * secret is removed from the chat. Uses HTML so the key sits in a copyable <code> block.
 */
export async function sendWalletReveal(ctx: BotContext, address: string, privateKey: string) {
  const body = [
    "🔐 <b>Your NimiqEarn wallet</b>",
    "",
    "<b>Address</b>",
    `<code>${escapeHtml(address)}</code>`,
    "",
    "<b>Private key</b> — tap to reveal, then copy",
    `<tg-spoiler><code>${escapeHtml(privateKey)}</code></tg-spoiler>`,
    "",
    "⚠️ <b>Save this key somewhere safe right now.</b> It is the ONLY way to control this wallet — we cannot recover it for you. Never share it: anyone who has it can take your funds.",
    "",
    "When you've saved it, tap the button below to remove it from this chat.",
  ].join("\n");

  await ctx.reply(body, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("✅ I've saved it — delete this", WALLET_REVEAL_DISMISS),
  });
}
