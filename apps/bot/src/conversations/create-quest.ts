import type { Conversation } from "@grammyjs/conversations";
import type { CreateQuestInput } from "@nimiqearn/shared";
import type { ApiClient } from "../api/client.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { creatorHubKeyboard } from "../menus/creator.js";
import { afterQuestSavedKeyboard, cancelStepKeyboard, NAV_CANCEL } from "../menus/nav.js";
import { escapeMarkdown } from "../utils/markdown.js";
import { StepChat } from "../utils/chat-cleanup.js";
import { waitForTextOrCancel } from "../utils/conversation-input.js";
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
    "*Review quest draft*",
    "",
    "Please confirm the details below before saving.",
    "",
    `*Title*\n${escapeMarkdown(draft.title)}`,
    "",
    `*Category*\n${CATEGORY_LABELS[draft.category]}`,
    "",
    `*Description*\n${escapeMarkdown(draft.description)}`,
    "",
    `*Reward*\n${draft.rewardAmount} NIM per slot`,
    "",
    `*Slots*\n${draft.totalSlots}`,
    "",
    `*Deadline*\n${formatDeadline(draft.deadline)}`,
    "",
    `*Proof type*\n${PROOF_TYPE_LABELS[draft.proofType]}`,
    "",
    `*Proof instructions*\n${escapeMarkdown(draft.proofInstructions)}`,
    "",
    "Select *Save Draft* to store this quest, or *Cancel* to discard it.",
  ].join("\n");
}

async function waitForCategory(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  stepChat: StepChat,
) {
  await stepChat.prompt(messages.quest.promptCategory, {
    parse_mode: "Markdown",
    reply_markup: categoryKeyboard(),
  });

  while (true) {
    const update = await conversation.waitFor("callback_query:data", {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: async () => {
        await stepChat.clearPrompts();
        await ctx.reply(messages.quest.timeout);
      },
    });

    const data = update.callbackQuery?.data;
    if (data === NAV_CANCEL) {
      await update.answerCallbackQuery();
      await stepChat.consumeCallback(update.callbackQuery.message?.message_id);
      return null;
    }

    if (!data?.startsWith(QUEST_CATEGORY_CALLBACK_PREFIX)) {
      await update.answerCallbackQuery();
      const hint = await update.reply(messages.quest.pickCategoryButton);
      stepChat.track(hint.message_id);
      continue;
    }

    const category = data.slice(QUEST_CATEGORY_CALLBACK_PREFIX.length) as CreateQuestInput["category"];
    await update.answerCallbackQuery();
    await stepChat.consumeCallback(update.callbackQuery.message?.message_id);
    return category;
  }
}

async function waitForProofType(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  stepChat: StepChat,
) {
  await stepChat.prompt(messages.quest.promptProofType, {
    parse_mode: "Markdown",
    reply_markup: proofTypeKeyboard(),
  });

  while (true) {
    const update = await conversation.waitFor("callback_query:data", {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: async () => {
        await stepChat.clearPrompts();
        await ctx.reply(messages.quest.timeout);
      },
    });

    const data = update.callbackQuery?.data;
    if (data === NAV_CANCEL) {
      await update.answerCallbackQuery();
      await stepChat.consumeCallback(update.callbackQuery.message?.message_id);
      return null;
    }

    if (!data?.startsWith(QUEST_PROOF_CALLBACK_PREFIX)) {
      await update.answerCallbackQuery();
      const hint = await update.reply(messages.quest.pickProofButton);
      stepChat.track(hint.message_id);
      continue;
    }

    const proofType = data.slice(QUEST_PROOF_CALLBACK_PREFIX.length) as CreateQuestInput["proofType"];
    await update.answerCallbackQuery();
    await stepChat.consumeCallback(update.callbackQuery.message?.message_id);
    return proofType;
  }
}

async function waitForConfirmation(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  draft: CreateQuestInput,
  stepChat: StepChat,
) {
  await stepChat.prompt(formatQuestSummary(draft), {
    parse_mode: "Markdown",
    reply_markup: confirmQuestKeyboard(),
  });

  while (true) {
    const update = await conversation.waitFor("callback_query:data", {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: async () => {
        await stepChat.clearPrompts();
        await ctx.reply(messages.quest.timeout);
      },
    });

    const data = update.callbackQuery?.data;
    await update.answerCallbackQuery();

    if (data === QUEST_CONFIRM_SAVE) {
      await stepChat.consumeCallback(update.callbackQuery?.message?.message_id);
      return true;
    }
    if (data === QUEST_CONFIRM_CANCEL) {
      await stepChat.consumeCallback(update.callbackQuery?.message?.message_id);
      return false;
    }

    const hint = await update.reply(messages.quest.pickConfirmButton);
    stepChat.track(hint.message_id);
  }
}

async function askTextStep(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  stepChat: StepChat,
  prompt: string,
) {
  await stepChat.prompt(prompt, {
    parse_mode: "Markdown",
    reply_markup: cancelStepKeyboard(),
  });

  return waitForTextOrCancel(conversation, ctx, {
    timeoutMs: STEP_TIMEOUT_MS,
    timeoutMessage: messages.quest.timeout,
    stepChat,
  });
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

    const stepChat = new StepChat(ctx);

    await stepChat.prompt(messages.quest.intro, { parse_mode: "Markdown" });

    const title = await askTextStep(conversation, ctx, stepChat, messages.quest.promptTitle);
    if (!title) {
      await ctx.reply(messages.quest.cancelled, { reply_markup: creatorHubKeyboard() });
      return;
    }
    if (title.length < 3) {
      await ctx.reply(messages.quest.invalidTitle, { reply_markup: creatorHubKeyboard() });
      return;
    }

    const category = await waitForCategory(conversation, ctx, stepChat);
    if (!category) {
      await ctx.reply(messages.quest.cancelled, { reply_markup: creatorHubKeyboard() });
      return;
    }

    const description = await askTextStep(
      conversation,
      ctx,
      stepChat,
      messages.quest.promptDescription,
    );
    if (!description) {
      await ctx.reply(messages.quest.cancelled, { reply_markup: creatorHubKeyboard() });
      return;
    }
    if (description.length < 10) {
      await ctx.reply(messages.quest.invalidDescription, { reply_markup: creatorHubKeyboard() });
      return;
    }

    await stepChat.prompt(messages.quest.promptReward, {
      parse_mode: "Markdown",
      reply_markup: cancelStepKeyboard(),
    });
    let rewardAmount: number | null = null;
    while (rewardAmount === null) {
      const rewardText = await waitForTextOrCancel(conversation, ctx, {
        timeoutMs: STEP_TIMEOUT_MS,
        timeoutMessage: messages.quest.timeout,
        stepChat,
      });
      if (!rewardText) {
        await ctx.reply(messages.quest.cancelled, { reply_markup: creatorHubKeyboard() });
        return;
      }
      rewardAmount = parsePositiveNumber(rewardText);
      if (rewardAmount === null) {
        await stepChat.prompt(messages.quest.invalidReward, {
          reply_markup: cancelStepKeyboard(),
        });
      }
    }

    await stepChat.prompt(messages.quest.promptSlots, {
      parse_mode: "Markdown",
      reply_markup: cancelStepKeyboard(),
    });
    let totalSlots: number | null = null;
    while (totalSlots === null) {
      const slotsText = await waitForTextOrCancel(conversation, ctx, {
        timeoutMs: STEP_TIMEOUT_MS,
        timeoutMessage: messages.quest.timeout,
        stepChat,
      });
      if (!slotsText) {
        await ctx.reply(messages.quest.cancelled, { reply_markup: creatorHubKeyboard() });
        return;
      }
      totalSlots = parsePositiveInt(slotsText);
      if (totalSlots === null) {
        await stepChat.prompt(messages.quest.invalidSlots, {
          reply_markup: cancelStepKeyboard(),
        });
      }
    }

    await stepChat.prompt(messages.quest.promptDeadline, {
      parse_mode: "Markdown",
      reply_markup: cancelStepKeyboard(),
    });
    let deadline: Date | null = null;
    while (deadline === null) {
      const deadlineText = await waitForTextOrCancel(conversation, ctx, {
        timeoutMs: STEP_TIMEOUT_MS,
        timeoutMessage: messages.quest.timeout,
        stepChat,
      });
      if (!deadlineText) {
        await ctx.reply(messages.quest.cancelled, { reply_markup: creatorHubKeyboard() });
        return;
      }
      deadline = parseDeadline(deadlineText);
      if (deadline === null) {
        await stepChat.prompt(messages.quest.invalidDeadline, {
          reply_markup: cancelStepKeyboard(),
        });
      }
    }

    const proofType = await waitForProofType(conversation, ctx, stepChat);
    if (!proofType) {
      await ctx.reply(messages.quest.cancelled, { reply_markup: creatorHubKeyboard() });
      return;
    }

    const proofInstructions = await askTextStep(
      conversation,
      ctx,
      stepChat,
      messages.quest.promptProofInstructions,
    );
    if (!proofInstructions) {
      await ctx.reply(messages.quest.cancelled, { reply_markup: creatorHubKeyboard() });
      return;
    }
    if (proofInstructions.length < 5) {
      await ctx.reply(messages.quest.invalidProofInstructions, { reply_markup: creatorHubKeyboard() });
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

    const confirmed = await waitForConfirmation(conversation, ctx, draft, stepChat);
    if (!confirmed) {
      await ctx.reply(messages.quest.cancelled, { reply_markup: creatorHubKeyboard() });
      return;
    }

    try {
      const quest = await conversation.external(() => api.createQuest(telegramId, draft));
      await ctx.reply(messages.quest.saved(quest.title), {
        parse_mode: "Markdown",
        reply_markup: afterQuestSavedKeyboard(),
      });
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "INVALID_QUEST") {
        await ctx.reply(messages.quest.invalidQuest, { reply_markup: creatorHubKeyboard() });
        return;
      }
      console.error("Quest creation failed:", error);
      await ctx.reply(messages.quest.saveFailed, { reply_markup: creatorHubKeyboard() });
    }
  };
}
