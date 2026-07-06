import type { Conversation } from "@grammyjs/conversations";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { afterWalletKeyboard } from "../menus/nav.js";
import { StepChat } from "../utils/chat-cleanup.js";
import { waitForTextOrCancel } from "../utils/conversation-input.js";

const WAIT_MS = 5 * 60 * 1000;

/**
 * Paste-to-link wallet flow: the user sends their Nimiq address and we validate + link it
 * (no signing). Loops on invalid/duplicate input so a typo doesn't drop them out of the flow.
 */
export function createLinkWalletConversation(api: ApiClient) {
  return async function linkWalletConversation(
    conversation: Conversation<BotContext, BotContext>,
    ctx: BotContext,
  ) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    const stepChat = new StepChat(ctx);
    await stepChat.prompt(messages.wallet.promptLink, { parse_mode: "Markdown" });

    while (true) {
      const address = await waitForTextOrCancel(conversation, ctx, {
        timeoutMs: WAIT_MS,
        timeoutMessage: messages.wallet.timeout,
        stepChat,
        inputHint: messages.wallet.promptLink,
      });

      if (address === null) {
        await ctx.reply(messages.wallet.cancelled);
        return;
      }

      try {
        const wallet = await conversation.external(() =>
          api.linkWalletByAddress(String(from.id), address),
        );
        await ctx.reply(messages.wallet.linked(wallet.nimiqAddress), {
          parse_mode: "Markdown",
          reply_markup: afterWalletKeyboard(),
        });
        return;
      } catch (error) {
        const code = (error as Error & { code?: string }).code;
        const message =
          code === "ADDRESS_IN_USE"
            ? messages.wallet.addressInUse
            : code === "ALREADY_LINKED"
              ? messages.wallet.alreadyLinked
              : code === "INVALID_ADDRESS"
                ? messages.wallet.invalidAddress
                : messages.wallet.linkFailed;

        // Show the error and re-prompt so they can try another address without restarting.
        await stepChat.prompt(message, { parse_mode: "Markdown" });
        if (code !== "INVALID_ADDRESS" && code !== "ADDRESS_IN_USE") {
          return; // unexpected/terminal error — don't loop forever
        }
      }
    }
  };
}
