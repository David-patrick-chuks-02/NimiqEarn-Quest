import type { Conversation } from "@grammyjs/conversations";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { mainMenuKeyboard } from "../menus/main.js";

const ADDRESS_WAIT_MS = 5 * 60 * 1000;

function formatLinkedWallet(address: string) {
  return address.replace(/(.{9})/g, "$1 ").trim();
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
      await ctx.reply(messages.wallet.current(user.wallet.nimiqAddress), {
        parse_mode: "Markdown",
      });
      await ctx.reply(messages.wallet.promptUpdate, { parse_mode: "Markdown" });
    } else {
      await ctx.reply(messages.wallet.promptLink, { parse_mode: "Markdown" });
    }

    const addressUpdate = await conversation.waitFor("message:text", {
      maxMilliseconds: ADDRESS_WAIT_MS,
      otherwise: async () => {
        await ctx.reply(messages.wallet.timeout);
      },
    });

    if (!addressUpdate.message?.text) return;

    const address = addressUpdate.message.text.trim();

    try {
      const wallet = await conversation.external(() => api.linkWallet(telegramId, address));
      await addressUpdate.reply(
        messages.wallet.linked(formatLinkedWallet(wallet.nimiqAddress)),
        {
          parse_mode: "Markdown",
          reply_markup: mainMenuKeyboard(),
        },
      );
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "INVALID_ADDRESS") {
        await addressUpdate.reply(messages.wallet.invalidAddress);
        return;
      }
      if (code === "ADDRESS_IN_USE") {
        await addressUpdate.reply(messages.wallet.addressInUse);
        return;
      }
      console.error("Wallet link failed:", error);
      await addressUpdate.reply(messages.wallet.linkFailed);
    }
  };
}
