import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { ApiClient } from "../api/client.js";
import { welcomeBannerFile } from "../assets/welcome-banner.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { mainMenuKeyboard } from "../menus/main.js";
import { StepChat } from "../utils/chat-cleanup.js";

const TERMS_WAIT_MS = 5 * 60 * 1000;

function displayNameFromUser(from: NonNullable<BotContext["from"]>) {
  const parts = [from.first_name, from.last_name].filter(Boolean);
  return parts.join(" ") || from.username || "Worker";
}

async function waitForTermsAgreement(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  stepChat: StepChat,
) {
  while (true) {
    const termsUpdate = await conversation.waitFor("callback_query:data", {
      maxMilliseconds: TERMS_WAIT_MS,
      otherwise: async () => {
        const hint = await ctx.reply(messages.errors.useButtons);
        stepChat.track(hint.message_id);
      },
    });

    if (!termsUpdate.callbackQuery) {
      return null;
    }

    if (termsUpdate.callbackQuery.data === "terms:agree") {
      await termsUpdate.answerCallbackQuery();
      await stepChat.consumeCallback(termsUpdate.callbackQuery.message?.message_id);
      return termsUpdate;
    }

    await termsUpdate.answerCallbackQuery({ text: messages.onboarding.termsWrongButtonToast });
    const hint = await termsUpdate.reply(messages.onboarding.termsWrongButton, {
      parse_mode: "Markdown",
    });
    stepChat.track(hint.message_id);
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
    const stepChat = new StepChat(ctx);

    // Single banner message with welcome + terms + the agree button (photo captions
    // support up to 1024 chars, Markdown, and inline keyboards) so it doesn't feel spammy.
    const termsKeyboard = new InlineKeyboard().text("I agree", "terms:agree");
    await stepChat.promptPhoto(welcomeBannerFile(), {
      caption: `${messages.onboarding.welcome(displayName)}\n\n${messages.onboarding.terms()}`,
      parse_mode: "Markdown",
      reply_markup: termsKeyboard,
    });

    const termsUpdate = await waitForTermsAgreement(conversation, ctx, stepChat);
    if (!termsUpdate) return;

    const profile = {
      telegramId: String(from.id),
      telegramUsername: from.username,
      displayName,
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

    await stepChat.clearPrompts();
    await termsUpdate.reply(messages.onboarding.complete(displayName), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  };
}
