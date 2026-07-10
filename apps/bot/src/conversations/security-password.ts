import type { Conversation } from "@grammyjs/conversations";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { mainMenuKeyboard } from "../menus/main.js";
import { StepChat } from "../utils/chat-cleanup.js";
import { waitForTextOrCancel } from "../utils/conversation-input.js";
import { escapeMarkdown } from "../utils/markdown.js";

const WAIT_MS = 5 * 60 * 1000;

/** Set / change / remove the secure-action password. Password messages are deleted as entered. */
export function createSecurityPasswordConversation(api: ApiClient) {
  return async function securityPasswordConversation(
    conversation: Conversation<BotContext, BotContext>,
    ctx: BotContext,
  ) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }
    // Session lives on the OUTER context — inside a conversation it must be read/written via
    // conversation.external, otherwise `ctx.session` is undefined and this throws on entry.
    const intent = await conversation.external((outerCtx) => {
      const value = outerCtx.session.securityIntent ?? "set";
      outerCtx.session.securityIntent = undefined;
      return value;
    });

    const stepChat = new StepChat(ctx);
    const ask = async (prompt: string) => {
      await stepChat.prompt(prompt, { parse_mode: "Markdown" });
      // consumeUserInput (inside waitForTextOrCancel via stepChat) deletes the typed password.
      return waitForTextOrCancel(conversation, ctx, {
        timeoutMs: WAIT_MS,
        timeoutMessage: messages.settings.cancelled,
        stepChat,
        inputHint: prompt,
      });
    };
    const fail = async (error: unknown) => {
      const detail = (error as Error).message || "Something went wrong.";
      await ctx.reply(`❌ ${escapeMarkdown(detail)}`, { reply_markup: mainMenuKeyboard() });
    };

    if (intent === "remove") {
      const current = await ask(messages.settings.enterCurrentToRemove);
      if (current === null) return void (await ctx.reply(messages.settings.cancelled));
      try {
        await conversation.external(() => api.clearSecurityPassword(String(from.id), current));
        await ctx.reply(messages.settings.passwordRemoved, { reply_markup: mainMenuKeyboard() });
      } catch (error) {
        await fail(error);
      }
      return;
    }

    let currentPassword: string | undefined;
    if (intent === "change") {
      const current = await ask(messages.settings.enterCurrent);
      if (current === null) return void (await ctx.reply(messages.settings.cancelled));
      currentPassword = current;
    }

    const next = await ask(messages.settings.enterNew);
    if (next === null) return void (await ctx.reply(messages.settings.cancelled));
    const confirm = await ask(messages.settings.confirmNew);
    if (confirm === null) return void (await ctx.reply(messages.settings.cancelled));
    if (confirm !== next) {
      await ctx.reply(messages.settings.mismatch, { reply_markup: mainMenuKeyboard() });
      return;
    }

    try {
      await conversation.external(() =>
        api.setSecurityPassword(String(from.id), next, currentPassword),
      );
      await ctx.reply(messages.settings.passwordSet, { reply_markup: mainMenuKeyboard() });
    } catch (error) {
      await fail(error);
    }
  };
}
