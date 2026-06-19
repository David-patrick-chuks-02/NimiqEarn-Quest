import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import { APP_NAME } from "@nimiqearn/shared";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { mainMenuKeyboard } from "../menus/main.js";

function displayNameFromUser(from: NonNullable<BotContext["from"]>) {
  const parts = [from.first_name, from.last_name].filter(Boolean);
  return parts.join(" ") || from.username || "Worker";
}

export function createOnboardingConversation(api: ApiClient) {
  return async function onboardingConversation(
    conversation: Conversation<BotContext, BotContext>,
    ctx: BotContext,
  ) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply("Could not read your Telegram profile. Please try /start again.");
      return;
    }

    await ctx.reply(
      `Welcome to *${APP_NAME}*!\n\nEarn NIM by completing quests in the Nimiq ecosystem — product tests, social campaigns, community tasks, and more.`,
      { parse_mode: "Markdown" },
    );

    const termsKeyboard = new InlineKeyboard().text("I agree", "terms:agree");
    await ctx.reply(
      "By continuing, you agree to complete tasks honestly and submit genuine proof. Fake submissions may lead to suspension.",
      { reply_markup: termsKeyboard },
    );

    const termsUpdate = await conversation.waitFor("callback_query:data");
    if (termsUpdate.callbackQuery.data !== "terms:agree") {
      await termsUpdate.reply("Please tap *I agree* to continue.", { parse_mode: "Markdown" });
      return;
    }
    await termsUpdate.answerCallbackQuery();

    const telegramId = String(from.id);
    const profile = {
      telegramId,
      telegramUsername: from.username,
      displayName: displayNameFromUser(from),
      role: "WORKER" as const,
    };

    try {
      await conversation.external(() => api.upsertUser(profile));
      await conversation.external((outerCtx) => {
        outerCtx.session.onboardingComplete = true;
      });
    } catch (error) {
      await termsUpdate.reply(
        "Something went wrong while saving your profile. Please try /start again in a moment.",
      );
      console.error("Onboarding upsert failed:", error);
      return;
    }

    await termsUpdate.reply(
      [
        "You're all set!",
        "",
        "Your worker profile is saved. *Wallet linking* arrives in Week 2 — you'll need a Nimiq address to receive rewards.",
        "",
        "Tap *Start Earning* below when you're ready to explore (more quests coming soon).",
      ].join("\n"),
      { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() },
    );
  };
}
