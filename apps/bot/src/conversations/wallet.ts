import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { CREATOR_CALLBACKS } from "../menus/creator.js";
import { mainMenuKeyboard, MAIN_MENU_CALLBACKS } from "../menus/main.js";
import { afterWalletKeyboard, cancelStepKeyboard } from "../menus/nav.js";
import { StepChat } from "../utils/chat-cleanup.js";
import { waitForTextOrCancel } from "../utils/conversation-input.js";

const ADDRESS_WAIT_MS = 5 * 60 * 1000;

function formatLinkedWallet(address: string) {
  return address.replace(/(.{9})/g, "$1 ").trim();
}

function walletRetryKeyboard() {
  return new InlineKeyboard()
    .text("Try again", MAIN_MENU_CALLBACKS.wallet)
    .text("Main Menu", CREATOR_CALLBACKS.backToMenu);
}

export function createWalletConversation(api: ApiClient) {
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

    try {
      const wallet = await conversation.external(() => api.linkWallet(telegramId, address));
      await ctx.reply(messages.wallet.linked(formatLinkedWallet(wallet.nimiqAddress)), {
        parse_mode: "Markdown",
        reply_markup: afterWalletKeyboard(),
      });
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
      console.error("Wallet link failed:", error);
      await ctx.reply(messages.wallet.linkFailed, { reply_markup: walletRetryKeyboard() });
    }
  };
}
