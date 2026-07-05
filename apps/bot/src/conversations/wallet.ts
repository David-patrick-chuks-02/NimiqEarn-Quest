import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { CREATOR_CALLBACKS } from "../menus/creator.js";
import { mainMenuKeyboard } from "../menus/main.js";
import { NAV_CANCEL } from "../menus/nav.js";
import { WALLET_CALLBACKS } from "../menus/wallet.js";
import { StepChat } from "../utils/chat-cleanup.js";

const SIGN_WAIT_MS = 15 * 60 * 1000;
const WALLET_VERIFY_CHECK = "wallet:verify:check";

function walletRetryKeyboard() {
  return new InlineKeyboard()
    .text("Try again", WALLET_CALLBACKS.link)
    .text("Main Menu", CREATOR_CALLBACKS.backToMenu);
}

function afterLinkedKeyboard() {
  return new InlineKeyboard()
    .text("Manage wallets", WALLET_CALLBACKS.open)
    .row()
    .text("Main Menu", CREATOR_CALLBACKS.backToMenu);
}

export function createWalletConversation(api: ApiClient, webBaseUrl: string) {
  const base = webBaseUrl.replace(/\/$/, "");

  return async function walletConversation(
    conversation: Conversation<BotContext, BotContext>,
    ctx: BotContext,
  ) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    const telegramId = String(from.id);
    const stepChat = new StepChat(ctx);

    // Snapshot the user's existing wallet ids so we can spot the newly linked one.
    let user;
    try {
      user = await conversation.external(() => api.getUserByTelegramId(telegramId));
    } catch (error) {
      console.error("Wallet user lookup failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
      return;
    }

    if (!user) {
      await ctx.reply(messages.wallet.notRegistered, { parse_mode: "Markdown" });
      return;
    }

    const beforeIds = new Set((user.wallets ?? []).map((wallet) => wallet.id));

    // Step 1: create the signing challenge (no address — it comes from the signature).
    let challenge;
    try {
      challenge = await conversation.external(() => api.startWalletChallenge(telegramId));
    } catch (error) {
      console.error("Wallet challenge failed:", error);
      await ctx.reply(messages.wallet.challengeFailed, { reply_markup: walletRetryKeyboard() });
      return;
    }

    // Step 2: ask the user to sign, then poll for a newly linked wallet.
    const signUrl = `${base}/link-wallet?token=${encodeURIComponent(challenge.token)}`;
    // Telegram only allows https URLs on inline buttons. In local dev (http/localhost),
    // fall back to sending the link in the message body so nothing errors.
    const isHttpsLink = signUrl.startsWith("https://");

    const keyboard = new InlineKeyboard();
    if (isHttpsLink) {
      keyboard.url("Sign with Nimiq", signUrl).row();
    }
    keyboard.text("I've signed", WALLET_VERIFY_CHECK).row().text("Cancel", NAV_CANCEL);

    const body = isHttpsLink
      ? messages.wallet.verifyInstructions()
      : messages.wallet.verifyInstructionsLink(signUrl);

    await stepChat.prompt(body, { parse_mode: "Markdown", reply_markup: keyboard });

    while (true) {
      const update = await conversation.waitFor("callback_query:data", {
        maxMilliseconds: SIGN_WAIT_MS,
        otherwise: async () => {
          const hint = await ctx.reply(messages.errors.useButtons);
          stepChat.track(hint.message_id);
        },
      });

      const data = update.callbackQuery?.data;

      if (data === NAV_CANCEL) {
        await update.answerCallbackQuery();
        await stepChat.consumeCallback(update.callbackQuery.message?.message_id);
        await ctx.reply(messages.wallet.cancelled, { reply_markup: mainMenuKeyboard() });
        return;
      }

      if (data !== WALLET_VERIFY_CHECK) {
        await update.answerCallbackQuery();
        continue;
      }

      let refreshed;
      try {
        refreshed = await conversation.external(() => api.getUserByTelegramId(telegramId));
      } catch (error) {
        console.error("Wallet status check failed:", error);
        await update.answerCallbackQuery({ text: messages.errors.apiUnavailable });
        continue;
      }

      const linked = (refreshed?.wallets ?? []).find((wallet) => !beforeIds.has(wallet.id));

      if (linked) {
        await update.answerCallbackQuery();
        await stepChat.consumeCallback(update.callbackQuery.message?.message_id);
        await ctx.reply(messages.wallet.linked(linked.nimiqAddress), {
          parse_mode: "Markdown",
          reply_markup: afterLinkedKeyboard(),
        });
        return;
      }

      await update.answerCallbackQuery({ text: messages.wallet.notVerifiedYet });
    }
  };
}
