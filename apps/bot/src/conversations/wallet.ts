import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { CREATOR_CALLBACKS } from "../menus/creator.js";
import { mainMenuKeyboard, MAIN_MENU_CALLBACKS } from "../menus/main.js";
import { afterWalletKeyboard, cancelStepKeyboard, NAV_CANCEL } from "../menus/nav.js";
import { StepChat } from "../utils/chat-cleanup.js";
import { waitForTextOrCancel } from "../utils/conversation-input.js";

const ADDRESS_WAIT_MS = 5 * 60 * 1000;
const SIGN_WAIT_MS = 15 * 60 * 1000;
const WALLET_VERIFY_CHECK = "wallet:verify:check";

function normalizeAddress(address: string) {
  return address.replace(/\s+/g, "").toUpperCase();
}

function walletRetryKeyboard() {
  return new InlineKeyboard()
    .text("Try again", MAIN_MENU_CALLBACKS.wallet)
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

    if (user.wallet) {
      await stepChat.prompt(messages.wallet.current(user.wallet.nimiqAddress), {
        parse_mode: "Markdown",
      });
      await stepChat.prompt(messages.wallet.promptUpdate, {
        parse_mode: "Markdown",
        reply_markup: cancelStepKeyboard(),
      });
    } else {
      await stepChat.prompt(messages.wallet.promptLink, {
        parse_mode: "Markdown",
        reply_markup: cancelStepKeyboard(),
      });
    }

    const address = await waitForTextOrCancel(conversation, ctx, {
      timeoutMs: ADDRESS_WAIT_MS,
      timeoutMessage: messages.wallet.timeout,
      stepChat,
      inputHint: messages.quest.inputHint,
    });

    if (!address) {
      await ctx.reply(messages.wallet.cancelled, { reply_markup: mainMenuKeyboard() });
      return;
    }

    // Step 1: create the signing challenge.
    let challenge;
    try {
      challenge = await conversation.external(() => api.startWalletChallenge(telegramId, address));
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "INVALID_ADDRESS") {
        await ctx.reply(messages.wallet.invalidAddress, { reply_markup: walletRetryKeyboard() });
        return;
      }
      if (code === "ADDRESS_IN_USE") {
        await ctx.reply(messages.wallet.addressInUse, { reply_markup: walletRetryKeyboard() });
        return;
      }
      console.error("Wallet challenge failed:", error);
      await ctx.reply(messages.wallet.challengeFailed, { reply_markup: walletRetryKeyboard() });
      return;
    }

    // Step 2: ask the user to sign, then poll for completion.
    const signUrl = `${base}/link-wallet?token=${encodeURIComponent(challenge.token)}`;
    const keyboard = new InlineKeyboard()
      .url("Sign with Nimiq", signUrl)
      .row()
      .text("I've signed", WALLET_VERIFY_CHECK)
      .row()
      .text("Cancel", NAV_CANCEL);

    await stepChat.prompt(messages.wallet.verifyInstructions(challenge.code), {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    while (true) {
      const update = await conversation.waitFor("callback_query:data", {
        maxMilliseconds: SIGN_WAIT_MS,
        otherwise: async () => {
          await stepChat.clearPrompts();
          await ctx.reply(messages.wallet.timeout);
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

      const wallet = refreshed?.wallet;
      const verified =
        wallet?.status === "VERIFIED" &&
        normalizeAddress(wallet.nimiqAddress) === normalizeAddress(challenge.address);

      if (verified) {
        await update.answerCallbackQuery();
        await stepChat.consumeCallback(update.callbackQuery.message?.message_id);
        await ctx.reply(messages.wallet.linked(wallet!.nimiqAddress), {
          parse_mode: "Markdown",
          reply_markup: afterWalletKeyboard(),
        });
        return;
      }

      await update.answerCallbackQuery({ text: messages.wallet.notVerifiedYet });
    }
  };
}
