import type { Conversation } from "@grammyjs/conversations";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { mainMenuKeyboard } from "../menus/main.js";
import { sendWalletReveal } from "../menus/wallet-reveal.js";
import { StepChat } from "../utils/chat-cleanup.js";
import { waitForTextOrCancel } from "../utils/conversation-input.js";
import { escapeMarkdown } from "../utils/markdown.js";

const WAIT_MS = 5 * 60 * 1000;

/**
 * Reveal (back up) the custodial private key on demand from Settings. Gated by the
 * secure-action password when one is set; the typed password is deleted as it's entered.
 */
export function createBackupKeyConversation(api: ApiClient) {
  return async function backupKeyConversation(
    conversation: Conversation<BotContext, BotContext>,
    ctx: BotContext,
  ) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    let password: string | undefined;
    const { passwordSet } = await conversation.external(() =>
      api.getSecurityStatus(String(from.id)),
    );
    if (passwordSet) {
      const stepChat = new StepChat(ctx);
      await stepChat.prompt(messages.settings.enterToBackup, { parse_mode: "Markdown" });
      const entered = await waitForTextOrCancel(conversation, ctx, {
        timeoutMs: WAIT_MS,
        timeoutMessage: messages.settings.cancelled,
        stepChat,
        inputHint: messages.settings.enterToBackup,
      });
      if (entered === null) return void (await ctx.reply(messages.settings.cancelled));
      password = entered;
    }

    try {
      const wallet = await conversation.external(() =>
        api.exportWalletKey(String(from.id), password),
      );
      await sendWalletReveal(ctx, wallet.nimiqAddress, wallet.privateKey);
    } catch (error) {
      const detail = (error as Error).message || "Something went wrong.";
      await ctx.reply(`❌ ${escapeMarkdown(detail)}`, { reply_markup: mainMenuKeyboard() });
    }
  };
}
