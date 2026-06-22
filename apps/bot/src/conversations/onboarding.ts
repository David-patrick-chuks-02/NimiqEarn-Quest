import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { mainMenuKeyboard } from "../menus/main.js";

const TERMS_WAIT_MS = 5 * 60 * 1000;

function displayNameFromUser(from: NonNullable<BotContext["from"]>) {
  const parts = [from.first_name, from.last_name].filter(Boolean);
  return parts.join(" ") || from.username || "Worker";
}

async function waitForTermsAgreement(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
) {
  while (true) {
    const termsUpdate = await conversation.waitFor("callback_query:data", {
      maxMilliseconds: TERMS_WAIT_MS,
      otherwise: async () => {
        await ctx.reply(messages.onboarding.termsTimeout);
      },
    });

    if (!termsUpdate.callbackQuery) {
      return null;
    }

    if (termsUpdate.callbackQuery.data === "terms:agree") {
      await termsUpdate.answerCallbackQuery();
      return termsUpdate;
    }

    await termsUpdate.answerCallbackQuery({ text: "Please tap I agree to continue." });
    await termsUpdate.reply(messages.onboarding.termsWrongButton, { parse_mode: "Markdown" });
  }
}

export function createOnboardingConversation(api: ApiClient) {
  return async function onboardingConversation(
    conversation: Conversation<BotContext, BotContext>,
    ctx: BotContext,
  ) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    const displayName = displayNameFromUser(from);

    await ctx.reply(messages.onboarding.welcome(displayName), { parse_mode: "Markdown" });

    const termsKeyboard = new InlineKeyboard().text("I agree", "terms:agree");
    await ctx.reply(messages.onboarding.terms, {
      parse_mode: "Markdown",
      reply_markup: termsKeyboard,
    });

    const termsUpdate = await waitForTermsAgreement(conversation, ctx);
    if (!termsUpdate) return;

    const profile = {
      telegramId: String(from.id),
      telegramUsername: from.username,
      displayName,
      role: "WORKER" as const,
    };

    try {
      await conversation.external(() => api.upsertUser(profile));
      await conversation.external((outerCtx) => {
        outerCtx.session.onboardingComplete = true;
      });
    } catch (error) {
      await termsUpdate.reply(messages.errors.profileSaveFailed);
      console.error("Onboarding upsert failed:", error);
      return;
    }

    await termsUpdate.reply(messages.onboarding.complete(displayName), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  };
}
