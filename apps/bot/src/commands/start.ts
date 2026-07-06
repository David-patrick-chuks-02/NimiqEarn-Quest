import type { CommandContext, NextFunction } from "grammy";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { sendCaptcha } from "../captcha.js";
import { sendMainMenu } from "../menus/main.js";
import { formatSharedQuest } from "../menus/shared-quest.js";
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

  // Shared-quest deep link (t.me/<bot>?start=q_<id>): show the quest, then continue.
  if (payload.startsWith("q_")) {
    try {
      const quest = await api.getPublicQuest(payload.slice(2));
      await ctx.reply(quest ? formatSharedQuest(quest) : messages.quests.sharedUnavailable, {
        parse_mode: "Markdown",
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
      await sendMainMenu(ctx, messages.menu.greeting(name));
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
  return async function captchaGuard(ctx: BotContext, next: NextFunction) {
    if (ctx.session.captchaVerified) return next();

    const pending = ctx.session.captcha;
    const text = ctx.message?.text?.trim();

    if (pending && text && !text.startsWith("/")) {
      if (text.toUpperCase() === pending.answer) {
        ctx.session.captchaVerified = true;
        ctx.session.captcha = undefined;
        await deleteMessageSafe(ctx, ctx.chat?.id, pending.messageId);
        await ctx.reply(messages.captcha.success);
        await runStart(ctx, api, pending.startPayload ?? "");
        return;
      }
      // Wrong: remove the old challenge and send a fresh one.
      await deleteMessageSafe(ctx, ctx.chat?.id, pending.messageId);
      await ctx.reply(messages.captcha.incorrect);
      await sendCaptcha(ctx, pending.startPayload);
      return;
    }

    // First contact (or a command / non-text while unverified) → issue a challenge.
    // Clear any existing one first so there's only ever a single live CAPTCHA.
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => undefined);
    if (pending) await deleteMessageSafe(ctx, ctx.chat?.id, pending.messageId);
    await sendCaptcha(ctx, startPayloadFromText(text) ?? pending?.startPayload);
  };
}
