import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { mainMenuKeyboard } from "../menus/main.js";
import { cancelStepKeyboard, NAV_CANCEL } from "../menus/nav.js";
import { StepChat } from "../utils/chat-cleanup.js";
import { waitForTextOrCancel } from "../utils/conversation-input.js";
import { escapeMarkdown } from "../utils/markdown.js";

const WAIT_MS = 5 * 60 * 1000;
const WITHDRAW_CONFIRM = "withdraw:confirm";
// Loose pre-check; the API does the real address validation (checksum) before sending.
const NQ_ADDRESS = /^NQ[0-9A-Z ]{20,}$/i;

/** Withdraw NIM from the custodial wallet to an external address (address → amount → confirm → send). */
export function createWithdrawConversation(api: ApiClient) {
  return async function withdrawConversation(
    conversation: Conversation<BotContext, BotContext>,
    ctx: BotContext,
  ) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    const stepChat = new StepChat(ctx);

    // 1. Recipient address.
    await stepChat.prompt(messages.withdraw.promptAddress, {
      parse_mode: "Markdown",
      reply_markup: cancelStepKeyboard(),
    });
    let recipient = "";
    while (!recipient) {
      const text = await waitForTextOrCancel(conversation, ctx, {
        timeoutMs: WAIT_MS,
        timeoutMessage: messages.withdraw.timeout,
        stepChat,
        inputHint: messages.withdraw.promptAddress,
      });
      if (text === null) {
        await ctx.reply(messages.withdraw.cancelled);
        return;
      }
      if (!NQ_ADDRESS.test(text.replace(/\s+/g, " ").trim())) {
        await stepChat.prompt(messages.withdraw.invalidAddress, { parse_mode: "Markdown" });
        continue;
      }
      recipient = text.trim();
    }

    // 2. Amount (a positive number, or "all").
    await stepChat.prompt(messages.withdraw.promptAmount, {
      parse_mode: "Markdown",
      reply_markup: cancelStepKeyboard(),
    });
    let amount: number | "all" | null = null;
    while (amount === null) {
      const text = await waitForTextOrCancel(conversation, ctx, {
        timeoutMs: WAIT_MS,
        timeoutMessage: messages.withdraw.timeout,
        stepChat,
        inputHint: messages.withdraw.promptAmount,
      });
      if (text === null) {
        await ctx.reply(messages.withdraw.cancelled);
        return;
      }
      const normalized = text.trim().toLowerCase();
      if (normalized === "all" || normalized === "max") {
        amount = "all";
        break;
      }
      const value = Number(normalized);
      if (!Number.isFinite(value) || value <= 0) {
        await stepChat.prompt(messages.withdraw.invalidAmount, { parse_mode: "Markdown" });
        continue;
      }
      amount = value;
    }

    // 3. Confirm.
    await stepChat.prompt(messages.withdraw.confirm(recipient, amount), {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard()
        .text("Confirm", WITHDRAW_CONFIRM)
        .text("Cancel", NAV_CANCEL),
    });
    const decision = await conversation.waitFor("callback_query:data", {
      maxMilliseconds: WAIT_MS,
      otherwise: (other) => other.reply(messages.errors.useButtons),
    });
    await decision.answerCallbackQuery();
    await stepChat.consumeCallback(decision.callbackQuery.message?.message_id);
    if (decision.callbackQuery.data !== WITHDRAW_CONFIRM) {
      await ctx.reply(messages.withdraw.cancelled);
      return;
    }

    // 3b. Secure-action password, if the user has one set.
    let password: string | undefined;
    const { passwordSet } = await conversation.external(() =>
      api.getSecurityStatus(String(from.id)),
    );
    if (passwordSet) {
      await stepChat.prompt(messages.settings.enterToWithdraw, {
        reply_markup: cancelStepKeyboard(),
      });
      const entered = await waitForTextOrCancel(conversation, ctx, {
        timeoutMs: WAIT_MS,
        timeoutMessage: messages.withdraw.timeout,
        stepChat,
        inputHint: messages.settings.enterToWithdraw,
      });
      if (entered === null) {
        await ctx.reply(messages.withdraw.cancelled);
        return;
      }
      password = entered;
    }

    // 4. Send.
    try {
      const result = await conversation.external(() =>
        api.withdraw(String(from.id), recipient, amount, password),
      );
      await ctx.reply(messages.withdraw.success(result.sentNim, result.recipient, result.hash), {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
    } catch (error) {
      const detail = (error as Error).message || "The withdrawal could not be completed.";
      await ctx.reply(`${escapeMarkdown(detail)}`, { reply_markup: mainMenuKeyboard() });
    }
  };
}
