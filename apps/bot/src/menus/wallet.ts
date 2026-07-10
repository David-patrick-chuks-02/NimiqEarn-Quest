import { InlineKeyboard, InputFile, type Bot } from "grammy";
import QRCode from "qrcode";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { editOrReply } from "../utils/edit-or-reply.js";
import { deleteMessageSafe } from "../utils/chat-cleanup.js";
import { hasActiveConversation } from "../utils/conversation.js";
import { CREATOR_CALLBACKS } from "./creator.js";
import { WALLET_REVEAL_DISMISS } from "./wallet-reveal.js";

export const WALLET_CALLBACKS = {
  open: "wallet:open",
  create: "wallet:create",
  deposit: "wallet:deposit",
  withdraw: "wallet:withdraw",
  refresh: "wallet:refresh",
  dismiss: WALLET_REVEAL_DISMISS,
} as const;

/** Prompt shown when a user needs a wallet (e.g. the Creator Hub gate). */
export function walletSetupKeyboard() {
  return new InlineKeyboard()
    .text("Create my wallet", WALLET_CALLBACKS.create)
    .row()
    .text("Main Menu", CREATOR_CALLBACKS.backToMenu);
}

function custodialWalletKeyboard(address: string) {
  return new InlineKeyboard()
    .copyText("Copy address", address)
    .row()
    .text("Deposit", WALLET_CALLBACKS.deposit)
    .text("Withdraw", WALLET_CALLBACKS.withdraw)
    .row()
    .text("Refresh", WALLET_CALLBACKS.refresh)
    .text("Main Menu", CREATOR_CALLBACKS.backToMenu);
}

/** Renders the user's custodial wallet (address + balance), or a create prompt. */
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

  const wallet = user.wallet ?? user.wallets?.[0] ?? null;
  if (!wallet) {
    await editOrReply(ctx, messages.wallet.noneYet, {
      parse_mode: "Markdown",
      reply_markup: walletSetupKeyboard(),
    });
    return;
  }

  // Best-effort on-chain balance (NIM + USD).
  let balanceNim: number | null = null;
  let balanceUsd: number | null = null;
  try {
    const balance = await api.getWalletBalance(String(from.id));
    if (balance?.reachable) {
      balanceNim = balance.balanceNim;
      balanceUsd = balance.balanceUsd;
    }
  } catch (error) {
    console.error("Wallet balance lookup failed:", error);
  }

  await editOrReply(ctx, messages.wallet.custodialView(wallet.nimiqAddress, balanceNim, balanceUsd), {
    parse_mode: "Markdown",
    reply_markup: custodialWalletKeyboard(wallet.nimiqAddress),
  });
}

export function registerWalletHandlers(bot: Bot<BotContext>, api: ApiClient) {
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
  bot.callbackQuery(WALLET_CALLBACKS.refresh, openWallet);

  // Create the custodial wallet on demand (recovery path; onboarding already creates one).
  bot.callbackQuery(WALLET_CALLBACKS.create, async (ctx) => {
    await ctx.answerCallbackQuery();
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }
    try {
      await api.createCustodialWallet(String(from.id));
      await renderWalletMenu(ctx, api);
    } catch (error) {
      console.error("Custodial wallet create failed:", error);
      await ctx.reply(messages.wallet.createFailed);
    }
  });

  // Deposit panel: show the wallet address + a scannable QR so funds can be sent in.
  bot.callbackQuery(WALLET_CALLBACKS.deposit, async (ctx) => {
    await ctx.answerCallbackQuery();
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }
    try {
      const user = await api.getUserByTelegramId(String(from.id));
      const wallet = user?.wallet ?? user?.wallets?.[0] ?? null;
      if (!wallet) {
        await renderWalletMenu(ctx, api);
        return;
      }
      const png = await QRCode.toBuffer(wallet.nimiqAddress, { margin: 1, width: 512 });
      await ctx.replyWithPhoto(new InputFile(png, "deposit-qr.png"), {
        caption: messages.wallet.deposit(wallet.nimiqAddress),
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard()
          .copyText("Copy address", wallet.nimiqAddress)
          .row()
          .text("‹ Back to wallet", WALLET_CALLBACKS.open),
      });
    } catch (error) {
      console.error("Deposit panel failed:", error);
      await ctx.reply(messages.wallet.depositFailed);
    }
  });

  // Withdraw NIM to an external address (multi-step conversation).
  bot.callbackQuery(WALLET_CALLBACKS.withdraw, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (hasActiveConversation(ctx)) {
      await ctx.reply(messages.errors.rateLimited);
      return;
    }
    await ctx.conversation.enter("withdraw");
  });

  // "I've saved it" — remove the key message from the chat.
  bot.callbackQuery(WALLET_CALLBACKS.dismiss, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Removed. Keep your key safe." });
    await deleteMessageSafe(ctx, ctx.chat?.id, ctx.callbackQuery.message?.message_id);
  });
}
