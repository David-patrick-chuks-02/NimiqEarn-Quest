import type { CommandContext, NextFunction } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { sendCaptcha } from "../captcha.js";
import { sendMainMenu } from "../menus/main.js";
import { formatSharedQuest, sharedQuestKeyboard } from "../menus/shared-quest.js";
import { deleteMessageSafe } from "../utils/chat-cleanup.js";
import { hasActiveConversation } from "../utils/conversation.js";

/**
 * The real start flow, run only once a user is CAPTCHA-verified: pinned security notice,
 * shared-quest deep link, then onboarding (new users) or the main menu (returning).
 */
async function runStart(ctx: BotContext, api: ApiClient, payload: string) {
  const from = ctx.from;
  if (!from) {
    await ctx.reply(messages.errors.noTelegramProfile);
    return;
  }
  const telegramId = String(from.id);

  // One-time pinned anti-scam notice. Telegram now injects ads into bots without our
  // approval, so warn the user once — the flag lives in the (Redis-backed) session.
  if (!ctx.session.securityNoticeShown && ctx.chat) {
    try {
      const notice = await ctx.reply(messages.securityNotice(ctx.me?.username), {
        parse_mode: "Markdown",
      });
      ctx.session.securityNoticeShown = true;
      void ctx.api
        .pinChatMessage(ctx.chat.id, notice.message_id, { disable_notification: true })
        .catch((error) => console.error("Failed to pin security notice:", error));
    } catch (error) {
      console.error("Failed to send security notice:", error);
    }
  }

  // Shared-quest deep link (t.me/<bot>?start=q_<id>): show the quest with a "Do this quest"
  // Mini App button, then continue.
  if (payload.startsWith("q_")) {
    try {
      const questId = payload.slice(2);
      const quest = await api.getPublicQuest(questId);
      await ctx.reply(quest ? formatSharedQuest(quest) : messages.quests.sharedUnavailable, {
        parse_mode: "Markdown",
        reply_markup: quest ? (sharedQuestKeyboard(questId) ?? undefined) : undefined,
      });
    } catch (error) {
      console.error("Shared quest lookup failed:", error);
    }
  }

  if (hasActiveConversation(ctx)) {
    await ctx.reply(messages.onboarding.alreadyInProgress);
    return;
  }

  try {
    const existing = await api.getUserByTelegramId(telegramId);
    if (existing) {
      const name = existing.displayName ?? from.first_name ?? "worker";
      await sendMainMenu(ctx, api, messages.menu.greeting(name));
      return;
    }
  } catch (error) {
    console.error("Start lookup failed:", error);
    await ctx.reply(messages.errors.apiUnavailable);
    return;
  }

  await ctx.conversation.enter("onboarding");
}

export function createStartCommand(api: ApiClient) {
  // By the time /start reaches here the CAPTCHA guard has already let it through.
  return async function startCommand(ctx: CommandContext<BotContext>) {
    const payload = typeof ctx.match === "string" ? ctx.match.trim() : "";
    // The /start command itself is chat noise once the menu renders — tidy it away.
    await deleteMessageSafe(ctx, ctx.chat?.id, ctx.message?.message_id);
    await runStart(ctx, api, payload);
  };
}

function startPayloadFromText(text: string | undefined): string | undefined {
  // Handles "/start payload" and the group-style "/start@BotName payload".
  const match = text?.match(/^\/start(?:@\S+)?(?:\s+(\S.*))?$/);
  const payload = match?.[1]?.trim();
  return payload && payload.length ? payload : undefined;
}

/**
 * Human-verification gate. Until a user solves an image CAPTCHA, everything they send is
 * consumed here (anti-spam). A wrong answer deletes the old challenge and issues a new one;
 * a correct one deletes it, confirms, and drops the user into the normal start flow.
 *
 * Registered AFTER the conversations plugin so ctx.conversation is available for runStart.
 */
export function createCaptchaGuard(api: ApiClient) {
  const MAX_FAILS = 5;
  const LOCK_MS = 60_000;

  return async function captchaGuard(ctx: BotContext, next: NextFunction) {
    if (ctx.session.captchaVerified) return next();

    const lockedUntil = ctx.session.captchaLockedUntil ?? 0;
    if (lockedUntil > Date.now()) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => undefined);
      await ctx.reply(messages.captcha.locked);
      return;
    }

    const pending = ctx.session.captcha;
    const text = ctx.message?.text?.trim();
    const incomingId = ctx.message?.message_id;

    if (pending && text && !text.startsWith("/")) {
      const noticeId = ctx.session.captchaNoticeId;

      if (text.toUpperCase() === pending.answer) {
        ctx.session.captchaVerified = true;
        ctx.session.captcha = undefined;
        ctx.session.captchaNoticeId = undefined;
        ctx.session.captchaFails = 0;
        ctx.session.captchaLockedUntil = undefined;
        // Show the next screen FIRST, then clear the challenge + the user's answer, so the
        // chat is never left empty between the two.
        await runStart(ctx, api, pending.startPayload ?? "");
        await deleteMessageSafe(ctx, ctx.chat?.id, pending.messageId);
        await deleteMessageSafe(ctx, ctx.chat?.id, noticeId);
        await deleteMessageSafe(ctx, ctx.chat?.id, incomingId);
        return;
      }

      const fails = (ctx.session.captchaFails ?? 0) + 1;
      ctx.session.captchaFails = fails;
      if (fails >= MAX_FAILS) {
        ctx.session.captchaLockedUntil = Date.now() + LOCK_MS;
        ctx.session.captcha = undefined;
        ctx.session.captchaFails = 0;
        await ctx.reply(messages.captcha.locked);
        await deleteMessageSafe(ctx, ctx.chat?.id, pending.messageId);
        await deleteMessageSafe(ctx, ctx.chat?.id, noticeId);
        await deleteMessageSafe(ctx, ctx.chat?.id, incomingId);
        return;
      }

      // Wrong: reissue a fresh challenge FIRST, then clear the old challenge + the answer.
      const notice = await ctx.reply(messages.captcha.incorrect);
      ctx.session.captchaNoticeId = notice.message_id;
      await sendCaptcha(ctx, pending.startPayload);
      await deleteMessageSafe(ctx, ctx.chat?.id, pending.messageId);
      await deleteMessageSafe(ctx, ctx.chat?.id, noticeId);
      await deleteMessageSafe(ctx, ctx.chat?.id, incomingId);
      return;
    }

    // First contact (or a command / non-text while unverified) → issue a challenge. Send the
    // CAPTCHA FIRST, then remove whatever the user sent (e.g. /start) so the chat is never
    // momentarily empty. Clear any existing challenge so there's only ever one live CAPTCHA.
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => undefined);
    const previousChallenge = pending?.messageId;
    await sendCaptcha(ctx, startPayloadFromText(text) ?? pending?.startPayload);
    if (previousChallenge) await deleteMessageSafe(ctx, ctx.chat?.id, previousChallenge);
    await deleteMessageSafe(ctx, ctx.chat?.id, incomingId);
  };
}
