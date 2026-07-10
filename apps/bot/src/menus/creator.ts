import { InlineKeyboard, type Bot } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { editOrReply } from "../utils/edit-or-reply.js";
import { sendMainMenu } from "./main.js";
import { walletHeader } from "./wallet-summary.js";
import { walletSetupKeyboard } from "./wallet.js";
import { hasActiveConversation } from "../utils/conversation.js";
import { formatCreatorDashboard } from "./creator-dashboard.js";
import { creatorQuestListKeyboard, formatCreatorQuestList } from "./quest-list.js";
import {
  QUEST_EDIT_CALLBACK_PREFIX,
  QUEST_PUBLISH_CALLBACK_PREFIX,
} from "../conversations/quest-keyboards.js";

export const CREATOR_CALLBACKS = {
  register: "creator:register",
  createQuest: "creator:create-quest",
  myQuests: "creator:my-quests",
  refresh: "creator:refresh",
  backToMenu: "creator:back-menu",
} as const;

/** Mini App base URL — web_app buttons require HTTPS (a Telegram requirement). */
function studioBaseUrl(): string | null {
  const base = (process.env.WEB_PUBLIC_URL ?? "").replace(/\/$/, "");
  return base.startsWith("https://") ? base : null;
}

export function creatorHubKeyboard() {
  // The Studio Mini App handles creating/drafting/publishing; the Manage Quests app is the
  // deeper analytics surface (per-quest charts). Both open only over HTTPS.
  const base = studioBaseUrl();
  if (base) {
    return new InlineKeyboard()
      .webApp("Open Creator Studio", `${base}/studio`)
      .row()
      .webApp("Manage Quests", `${base}/studio/manage`)
      .row()
      .text("Refresh", CREATOR_CALLBACKS.refresh)
      .text("Main Menu", CREATOR_CALLBACKS.backToMenu);
  }

  // Fallback when the web app isn't served over HTTPS (web_app buttons require HTTPS) —
  // e.g. local dev. Keeps the chat wizard reachable.
  return new InlineKeyboard()
    .text("Create Quest", CREATOR_CALLBACKS.createQuest)
    .row()
    .text("My Quests", CREATOR_CALLBACKS.myQuests)
    .row()
    .text("Refresh", CREATOR_CALLBACKS.refresh)
    .text("Main Menu", CREATOR_CALLBACKS.backToMenu);
}

export function creatorRegisterKeyboard() {
  return new InlineKeyboard()
    .text("Become a Creator", CREATOR_CALLBACKS.register)
    .row()
    .text("Main Menu", CREATOR_CALLBACKS.backToMenu);
}

function isCreatorRole(role: string) {
  return role === "CREATOR" || role === "ADMIN";
}

export async function openCreatorEntry(ctx: BotContext, api: ApiClient) {
  const from = ctx.from;
  if (!from) {
    await ctx.reply(messages.errors.noTelegramProfile);
    return;
  }

  const user = await api.getUserByTelegramId(String(from.id));
  if (!user) {
    await ctx.reply(messages.creator.notRegistered, { parse_mode: "Markdown" });
    return;
  }

  // Gate the Creator Hub behind a linked wallet — payouts and refunds need one.
  const hasWallet = Boolean(user.wallet) || (user.wallets?.length ?? 0) > 0;
  if (!hasWallet) {
    await editOrReply(ctx, messages.creator.walletRequired, {
      parse_mode: "Markdown",
      reply_markup: walletSetupKeyboard(),
    });
    return;
  }

  if (isCreatorRole(user.role)) {
    await sendCreatorHub(ctx, api);
    return;
  }

  await editOrReply(ctx, messages.creator.invite, {
    parse_mode: "Markdown",
    reply_markup: creatorRegisterKeyboard(),
  });
}

async function sendCreatorQuestList(ctx: BotContext, api: ApiClient) {
  const from = ctx.from;
  if (!from) return;

  const quests = await api.listCreatorQuests(String(from.id));
  const text = formatCreatorQuestList(quests);
  const keyboard = creatorQuestListKeyboard(quests);
  keyboard.row().text("Creator Hub", "creator:back-dashboard");
  keyboard.text("Main Menu", CREATOR_CALLBACKS.backToMenu);

  const options = { parse_mode: "Markdown" as const, reply_markup: keyboard };

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, options);
      return;
    } catch {
      // Message unchanged or too old — send a fresh one below.
    }
  }

  await ctx.reply(text, options);
}

export async function sendCreatorHub(ctx: BotContext, api: ApiClient) {
  const from = ctx.from;
  if (!from) return;

  const [dashboard, header] = await Promise.all([
    api.getCreatorDashboard(String(from.id)),
    walletHeader(api, String(from.id)),
  ]);
  await editOrReply(ctx, header + formatCreatorDashboard(dashboard), {
    parse_mode: "Markdown",
    reply_markup: creatorHubKeyboard(),
  });
}

export function registerCreatorHandlers(bot: Bot<BotContext>, api: ApiClient) {
  bot.callbackQuery(CREATOR_CALLBACKS.register, async (ctx) => {
    const from = ctx.from;
    if (!from) {
      await ctx.answerCallbackQuery();
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    try {
      await api.registerCreator(String(from.id));
      // Toast confirms the upgrade; the invite message edits straight into the hub.
      await ctx.answerCallbackQuery({ text: "Creator account activated" });
      await sendCreatorHub(ctx, api);
    } catch (error) {
      await ctx.answerCallbackQuery();
      const code = (error as Error & { code?: string }).code;
      if (code === "SUSPENDED") {
        await ctx.reply(messages.creator.suspended);
        return;
      }
      if (code === "NOT_VERIFIED") {
        await ctx.reply(messages.creator.notVerified, { parse_mode: "Markdown" });
        return;
      }
      console.error("Creator registration failed:", error);
      await ctx.reply(messages.creator.registerFailed);
    }
  });

  bot.callbackQuery(CREATOR_CALLBACKS.createQuest, async (ctx) => {
    await ctx.answerCallbackQuery();

    if (hasActiveConversation(ctx)) {
      await ctx.reply(messages.quest.alreadyInProgress);
      return;
    }

    await ctx.conversation.enter("createQuest");
  });

  bot.callbackQuery(CREATOR_CALLBACKS.myQuests, async (ctx) => {
    await ctx.answerCallbackQuery();

    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    try {
      await sendCreatorQuestList(ctx, api);
    } catch (error) {
      console.error("Creator quest list failed:", error);
      await ctx.reply(messages.quest.listFailed, { reply_markup: creatorHubKeyboard() });
    }
  });

  bot.callbackQuery("creator:back-dashboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await openCreatorEntry(ctx, api);
    } catch (error) {
      console.error("Creator hub navigation failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  });

  // Re-fetch the dashboard + wallet balance and re-render the hub in place.
  bot.callbackQuery(CREATOR_CALLBACKS.refresh, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Refreshing…" });
    try {
      await openCreatorEntry(ctx, api);
    } catch (error) {
      console.error("Creator hub refresh failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  });

  bot.callbackQuery(new RegExp(`^${QUEST_PUBLISH_CALLBACK_PREFIX}`), async (ctx) => {
    const from = ctx.from;
    if (!from) {
      await ctx.answerCallbackQuery();
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    const data = ctx.callbackQuery.data;
    const questId = data?.slice(QUEST_PUBLISH_CALLBACK_PREFIX.length);
    if (!questId) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      await api.publishQuest(String(from.id), questId);
      await ctx.answerCallbackQuery({ text: messages.quest.publishedToast });
      await sendCreatorQuestList(ctx, api);
    } catch (error) {
      await ctx.answerCallbackQuery();
      const code = (error as Error & { code?: string }).code;
      if (code === "INVALID_STATUS") {
        await ctx.reply(messages.quest.publishNotDraft);
        return;
      }
      if (code === "QUEST_NOT_FOUND") {
        await ctx.reply(messages.quest.publishNotFound);
        return;
      }
      if (code === "INVALID_QUEST") {
        await ctx.reply(messages.quest.publishDeadlinePassed);
        return;
      }
      // Custodial funding errors carry a descriptive message (insufficient balance, no wallet, …).
      if (
        code === "INSUFFICIENT_BALANCE" ||
        code === "NO_WALLET" ||
        code === "RPC_UNAVAILABLE" ||
        code === "FUNDING_FAILED"
      ) {
        await ctx.reply(`${(error as Error).message}`);
        return;
      }
      console.error("Quest publish failed:", error);
      await ctx.reply(messages.quest.publishFailed);
    }
  });

  bot.callbackQuery(new RegExp(`^${QUEST_EDIT_CALLBACK_PREFIX}`), async (ctx) => {
    const from = ctx.from;
    if (!from) {
      await ctx.answerCallbackQuery();
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }

    const questId = ctx.callbackQuery.data?.slice(QUEST_EDIT_CALLBACK_PREFIX.length);
    if (!questId) {
      await ctx.answerCallbackQuery();
      return;
    }

    if (hasActiveConversation(ctx)) {
      await ctx.answerCallbackQuery();
      await ctx.reply(messages.quest.alreadyInProgress);
      return;
    }

    await ctx.answerCallbackQuery();
    ctx.session.editQuestId = questId;
    await ctx.conversation.enter("editQuest");
  });

  bot.callbackQuery(CREATOR_CALLBACKS.backToMenu, async (ctx) => {
    await ctx.answerCallbackQuery();
    const name = ctx.from?.first_name ?? "there";
    await sendMainMenu(ctx, api, messages.menu.greeting(name));
  });
}
