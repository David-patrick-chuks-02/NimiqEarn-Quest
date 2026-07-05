import { InlineKeyboard, type Bot } from "grammy";
import type { ApiClient, ApiWalletListItem } from "../api/client.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { escapeMarkdown } from "../utils/markdown.js";
import { CREATOR_CALLBACKS } from "./creator.js";

export const WALLET_CALLBACKS = {
  open: "wallet:open",
  link: "wallet:link",
  primaryPrefix: "wallet:primary:",
  unlinkPrefix: "wallet:unlink:",
} as const;

function walletMenuKeyboard(wallets: ApiWalletListItem[]) {
  const keyboard = new InlineKeyboard();

  wallets.forEach((wallet, index) => {
    const n = index + 1;
    if (!wallet.isPrimary) {
      keyboard.text(`⭐ Make #${n} primary`, `${WALLET_CALLBACKS.primaryPrefix}${wallet.id}`);
    }
    keyboard.text(`🗑 Unlink #${n}`, `${WALLET_CALLBACKS.unlinkPrefix}${wallet.id}`).row();
  });

  keyboard.text("➕ Link another wallet", WALLET_CALLBACKS.link).row();
  keyboard.text("Main Menu", CREATOR_CALLBACKS.backToMenu);
  return keyboard;
}

function renderWalletList(wallets: ApiWalletListItem[]): string {
  if (wallets.length === 0) {
    return messages.walletMenu.empty;
  }

  const lines = wallets.map((wallet, index) => {
    const badge = wallet.isPrimary ? " ⭐ *Primary*" : "";
    return `${index + 1}. \`${escapeMarkdown(wallet.nimiqAddress)}\`${badge}`;
  });

  return [messages.walletMenu.header, "", ...lines].join("\n");
}

/** Fetches the user's wallets and renders the management view. */
export async function renderWalletMenu(ctx: BotContext, api: ApiClient) {
  const from = ctx.from;
  if (!from) {
    await ctx.reply(messages.errors.noTelegramProfile);
    return;
  }

  const user = await api.getUserByTelegramId(String(from.id));
  if (!user) {
    await ctx.reply(messages.menu.notRegistered, { parse_mode: "Markdown" });
    return;
  }

  const wallets = user.wallets ?? [];
  const keyboard = wallets.length
    ? walletMenuKeyboard(wallets)
    : new InlineKeyboard()
        .text("➕ Link a wallet", WALLET_CALLBACKS.link)
        .row()
        .text("Main Menu", CREATOR_CALLBACKS.backToMenu);

  await ctx.reply(renderWalletList(wallets), { parse_mode: "Markdown", reply_markup: keyboard });
}

export function registerWalletHandlers(bot: Bot<BotContext>, api: ApiClient, webBaseUrl: string) {
  const base = webBaseUrl.replace(/\/$/, "");

  const openWallet = async (ctx: BotContext) => {
    await ctx.answerCallbackQuery();
    try {
      await renderWalletMenu(ctx, api);
    } catch (error) {
      console.error("Wallet menu failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  };

  bot.callbackQuery(WALLET_CALLBACKS.open, openWallet);

  // Create a signing challenge and hand the user a link. No "I've signed" step — the API
  // pushes a "wallet connected" message here automatically once they sign.
  bot.callbackQuery(WALLET_CALLBACKS.link, async (ctx) => {
    await ctx.answerCallbackQuery();
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    let challenge;
    try {
      challenge = await api.startWalletChallenge(String(from.id));
    } catch (error) {
      console.error("Wallet challenge failed:", error);
      await ctx.reply(messages.wallet.challengeFailed, { parse_mode: "Markdown" });
      return;
    }

    const signUrl = `${base}/link-wallet?token=${encodeURIComponent(challenge.token)}`;
    const isHttps = signUrl.startsWith("https://");

    const keyboard = new InlineKeyboard();
    if (isHttps) keyboard.url("Sign with Nimiq", signUrl).row();
    keyboard.text("My Wallets", WALLET_CALLBACKS.open);

    const body = isHttps
      ? messages.wallet.verifyInstructions()
      : messages.wallet.verifyInstructionsLink(signUrl);

    await ctx.reply(body, { parse_mode: "Markdown", reply_markup: keyboard });
  });

  bot.callbackQuery(new RegExp(`^${WALLET_CALLBACKS.primaryPrefix}`), async (ctx) => {
    const from = ctx.from;
    const walletId = ctx.callbackQuery.data?.slice(WALLET_CALLBACKS.primaryPrefix.length);
    if (!from || !walletId) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      await api.setPrimaryWallet(String(from.id), walletId);
    } catch (error) {
      console.error("Set primary wallet failed:", error);
      await ctx.answerCallbackQuery({ text: messages.walletMenu.actionFailed });
      return;
    }
    await ctx.answerCallbackQuery({ text: messages.walletMenu.primarySet });
    // Re-render separately so a refresh blip can't trigger a second answerCallbackQuery.
    await renderWalletMenu(ctx, api).catch((error) => {
      console.error("Wallet menu refresh failed:", error);
    });
  });

  bot.callbackQuery(new RegExp(`^${WALLET_CALLBACKS.unlinkPrefix}`), async (ctx) => {
    const from = ctx.from;
    const walletId = ctx.callbackQuery.data?.slice(WALLET_CALLBACKS.unlinkPrefix.length);
    if (!from || !walletId) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      await api.unlinkWallet(String(from.id), walletId);
    } catch (error) {
      console.error("Unlink wallet failed:", error);
      await ctx.answerCallbackQuery({ text: messages.walletMenu.actionFailed });
      return;
    }
    await ctx.answerCallbackQuery({ text: messages.walletMenu.unlinked });
    await renderWalletMenu(ctx, api).catch((error) => {
      console.error("Wallet menu refresh failed:", error);
    });
  });
}
