import type { Conversation } from "@grammyjs/conversations";
import type { CreateQuestInput } from "@nimiqearn/shared";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { creatorHubKeyboard } from "../menus/creator.js";
import {
  CATEGORY_LABELS,
  PROOF_TYPE_LABELS,
  QUEST_CATEGORY_CALLBACK_PREFIX,
  QUEST_CONFIRM_CANCEL,
  QUEST_CONFIRM_SAVE,
  QUEST_PROOF_CALLBACK_PREFIX,
  categoryKeyboard,
  confirmQuestKeyboard,
  proofTypeKeyboard,
} from "./quest-keyboards.js";

const STEP_TIMEOUT_MS = 5 * 60 * 1000;

function isCreatorRole(role: string) {
  return role === "CREATOR" || role === "ADMIN";
}

function parsePositiveNumber(text: string): number | null {
  const value = Number(text.trim().replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parsePositiveInt(text: string): number | null {
  const value = parsePositiveNumber(text);
  if (value === null || !Number.isInteger(value)) return null;
  return value;
}

function parseDeadline(text: string): Date | null {
  const trimmed = text.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59.000Z`)
    : new Date(trimmed);

  if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) {
    return null;
  }

  return parsed;
}

function formatDeadline(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatQuestSummary(draft: CreateQuestInput) {
  return [
    "*Review your quest draft*",
    "",
    `*Title:* ${draft.title}`,
    `*Category:* ${CATEGORY_LABELS[draft.category]}`,
    `*Description:* ${draft.description}`,
    `*Reward:* ${draft.rewardAmount} NIM`,
    `*Slots:* ${draft.totalSlots}`,
    `*Deadline:* ${formatDeadline(draft.deadline)}`,
    `*Proof:* ${PROOF_TYPE_LABELS[draft.proofType]}`,
    `*Instructions:* ${draft.proofInstructions}`,
    "",
    "Tap *Save Draft* to store this quest, or *Cancel* to discard it.",
  ].join("\n");
}

async function waitForText(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  timeoutMessage: string,
) {
  const update = await conversation.waitFor("message:text", {
    maxMilliseconds: STEP_TIMEOUT_MS,
    otherwise: async () => {
      await ctx.reply(timeoutMessage);
    },
  });

  return update.message?.text?.trim() ?? null;
}

async function waitForCategory(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
) {
  await ctx.reply(messages.quest.promptCategory, {
    parse_mode: "Markdown",
    reply_markup: categoryKeyboard(),
  });

  while (true) {
    const update = await conversation.waitFor("callback_query:data", {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: async () => {
        await ctx.reply(messages.quest.timeout);
      },
    });

    const data = update.callbackQuery?.data;
    if (!data?.startsWith(QUEST_CATEGORY_CALLBACK_PREFIX)) {
      await update.answerCallbackQuery();
      await update.reply(messages.quest.pickCategoryButton);
      continue;
    }

    const category = data.slice(QUEST_CATEGORY_CALLBACK_PREFIX.length) as CreateQuestInput["category"];
    await update.answerCallbackQuery();
    return category;
  }
}

async function waitForProofType(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
) {
  await ctx.reply(messages.quest.promptProofType, {
    parse_mode: "Markdown",
    reply_markup: proofTypeKeyboard(),
  });

  while (true) {
    const update = await conversation.waitFor("callback_query:data", {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: async () => {
        await ctx.reply(messages.quest.timeout);
      },
    });

    const data = update.callbackQuery?.data;
    if (!data?.startsWith(QUEST_PROOF_CALLBACK_PREFIX)) {
      await update.answerCallbackQuery();
      await update.reply(messages.quest.pickProofButton);
      continue;
    }

    const proofType = data.slice(QUEST_PROOF_CALLBACK_PREFIX.length) as CreateQuestInput["proofType"];
    await update.answerCallbackQuery();
    return proofType;
  }
}

async function waitForConfirmation(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  draft: CreateQuestInput,
) {
  await ctx.reply(formatQuestSummary(draft), {
    parse_mode: "Markdown",
    reply_markup: confirmQuestKeyboard(),
  });

  while (true) {
    const update = await conversation.waitFor("callback_query:data", {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: async () => {
        await ctx.reply(messages.quest.timeout);
      },
    });

    const data = update.callbackQuery?.data;
    await update.answerCallbackQuery();

    if (data === QUEST_CONFIRM_SAVE) {
      return true;
    }
    if (data === QUEST_CONFIRM_CANCEL) {
      return false;
    }

    await update.reply(messages.quest.pickConfirmButton);
  }
}

export function createQuestConversation(api: ApiClient) {
  return async function createQuestConversation(
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
      console.error("Quest creation user lookup failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
      return;
    }

    if (!user) {
      await ctx.reply(messages.creator.notRegistered, { parse_mode: "Markdown" });
      return;
    }

    if (!isCreatorRole(user.role)) {
      await ctx.reply(messages.quest.notCreator, { parse_mode: "Markdown" });
      return;
    }

    await ctx.reply(messages.quest.intro, { parse_mode: "Markdown" });

    await ctx.reply(messages.quest.promptTitle, { parse_mode: "Markdown" });
    const title = await waitForText(conversation, ctx, messages.quest.timeout);
    if (!title || title.length < 3) {
      await ctx.reply(messages.quest.invalidTitle);
      return;
    }

    const category = await waitForCategory(conversation, ctx);

    await ctx.reply(messages.quest.promptDescription, { parse_mode: "Markdown" });
    const description = await waitForText(conversation, ctx, messages.quest.timeout);
    if (!description || description.length < 10) {
      await ctx.reply(messages.quest.invalidDescription);
      return;
    }

    await ctx.reply(messages.quest.promptReward, { parse_mode: "Markdown" });
    let rewardAmount: number | null = null;
    while (rewardAmount === null) {
      const rewardText = await waitForText(conversation, ctx, messages.quest.timeout);
      if (!rewardText) return;
      rewardAmount = parsePositiveNumber(rewardText);
      if (rewardAmount === null) {
        await ctx.reply(messages.quest.invalidReward);
      }
    }

    await ctx.reply(messages.quest.promptSlots, { parse_mode: "Markdown" });
    let totalSlots: number | null = null;
    while (totalSlots === null) {
      const slotsText = await waitForText(conversation, ctx, messages.quest.timeout);
      if (!slotsText) return;
      totalSlots = parsePositiveInt(slotsText);
      if (totalSlots === null) {
        await ctx.reply(messages.quest.invalidSlots);
      }
    }

    await ctx.reply(messages.quest.promptDeadline, { parse_mode: "Markdown" });
    let deadline: Date | null = null;
    while (deadline === null) {
      const deadlineText = await waitForText(conversation, ctx, messages.quest.timeout);
      if (!deadlineText) return;
      deadline = parseDeadline(deadlineText);
      if (deadline === null) {
        await ctx.reply(messages.quest.invalidDeadline);
      }
    }

    const proofType = await waitForProofType(conversation, ctx);

    await ctx.reply(messages.quest.promptProofInstructions, { parse_mode: "Markdown" });
    const proofInstructions = await waitForText(conversation, ctx, messages.quest.timeout);
    if (!proofInstructions || proofInstructions.length < 5) {
      await ctx.reply(messages.quest.invalidProofInstructions);
      return;
    }

    const draft: CreateQuestInput = {
      title,
      category,
      description,
      rewardAmount,
      totalSlots,
      deadline,
      proofType,
      proofInstructions,
    };

    const confirmed = await waitForConfirmation(conversation, ctx, draft);
    if (!confirmed) {
      await ctx.reply(messages.quest.cancelled, { reply_markup: creatorHubKeyboard() });
      return;
    }

    try {
      const quest = await conversation.external(() => api.createQuest(telegramId, draft));
      await ctx.reply(messages.quest.saved(quest.title), {
        parse_mode: "Markdown",
        reply_markup: creatorHubKeyboard(),
      });
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "INVALID_QUEST") {
        await ctx.reply(messages.quest.invalidQuest);
        return;
      }
      console.error("Quest creation failed:", error);
      await ctx.reply(messages.quest.saveFailed, { reply_markup: creatorHubKeyboard() });
    }
  };
}
