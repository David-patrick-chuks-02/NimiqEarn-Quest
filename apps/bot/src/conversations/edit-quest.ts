import type { Conversation } from "@grammyjs/conversations";
import type { UpdateQuestInput } from "@nimiqearn/shared";
import type { ApiClient } from "../api/client.js";
import type { ApiQuest } from "../api/types.js";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { creatorHubKeyboard } from "../menus/creator.js";
import { cancelStepKeyboard } from "../menus/nav.js";
import { escapeMarkdown } from "../utils/markdown.js";
import { StepChat } from "../utils/chat-cleanup.js";
import { waitForTextOrCancel } from "../utils/conversation-input.js";
import {
  formatDeadline,
  parseDeadline,
  parsePositiveInt,
  parsePositiveNumber,
} from "../utils/quest-input.js";
import {
  askTextStep,
  STEP_TIMEOUT_MS,
  waitForCategory,
  waitForProofType,
} from "./create-quest.js";
import {
  CATEGORY_LABELS,
  PROOF_TYPE_LABELS,
  QUEST_EDIT_FIELD_PREFIX,
  QUEST_EDIT_FINISH,
  editFieldsKeyboard,
  type EditableQuestField,
} from "./quest-keyboards.js";

function isCreatorRole(role: string) {
  return role === "CREATOR" || role === "ADMIN";
}

function formatOverview(quest: ApiQuest): string {
  const category =
    CATEGORY_LABELS[quest.category as keyof typeof CATEGORY_LABELS] ?? quest.category;
  const proof =
    PROOF_TYPE_LABELS[quest.proofType as keyof typeof PROOF_TYPE_LABELS] ?? quest.proofType;

  return [
    "*Editing draft*",
    "",
    `*Title*\n${escapeMarkdown(quest.title)}`,
    `*Category* · ${category}`,
    `*Reward* · ${quest.rewardAmount} NIM per slot`,
    `*Slots* · ${quest.totalSlots}`,
    `*Deadline* · ${formatDeadline(new Date(quest.deadline))}`,
    `*Proof type* · ${proof}`,
    "",
    "Select a field to edit, or tap *Done*.",
  ].join("\n");
}

async function waitForEditField(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  stepChat: StepChat,
): Promise<EditableQuestField | "done" | null> {
  while (true) {
    const update = await conversation.waitFor("callback_query:data", {
      maxMilliseconds: STEP_TIMEOUT_MS,
      otherwise: async () => {
        await stepChat.clearPrompts();
        await ctx.reply(messages.quest.edit.timeout);
      },
    });

    const data = update.callbackQuery?.data;
    if (data === QUEST_EDIT_FINISH) {
      await update.answerCallbackQuery();
      await stepChat.consumeCallback(update.callbackQuery.message?.message_id);
      return "done";
    }

    if (data?.startsWith(QUEST_EDIT_FIELD_PREFIX)) {
      await update.answerCallbackQuery();
      await stepChat.consumeCallback(update.callbackQuery.message?.message_id);
      return data.slice(QUEST_EDIT_FIELD_PREFIX.length) as EditableQuestField;
    }

    await update.answerCallbackQuery();
    const hint = await update.reply(messages.quest.edit.pickField, { parse_mode: "Markdown" });
    stepChat.track(hint.message_id);
  }
}

async function askNumber(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  stepChat: StepChat,
  prompt: string,
  invalid: string,
  parse: (text: string) => number | null,
): Promise<number | null> {
  await stepChat.prompt(prompt, { parse_mode: "Markdown", reply_markup: cancelStepKeyboard() });
  while (true) {
    const text = await waitForTextOrCancel(conversation, ctx, {
      timeoutMs: STEP_TIMEOUT_MS,
      timeoutMessage: messages.quest.edit.timeout,
      stepChat,
    });
    if (!text) return null;
    const value = parse(text);
    if (value !== null) return value;
    await stepChat.prompt(invalid, { reply_markup: cancelStepKeyboard() });
  }
}

/** Returns the patch for the chosen field, or null if the creator cancelled the step. */
async function collectFieldValue(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  stepChat: StepChat,
  field: EditableQuestField,
): Promise<UpdateQuestInput | null> {
  switch (field) {
    case "title": {
      const value = await askTextStep(conversation, ctx, stepChat, messages.quest.promptTitle);
      if (!value) return null;
      if (value.length < 3 || value.length > 100) {
        await stepChat.prompt(messages.quest.invalidTitle, { parse_mode: "Markdown" });
        return null;
      }
      return { title: value };
    }
    case "description": {
      const value = await askTextStep(
        conversation,
        ctx,
        stepChat,
        messages.quest.promptDescription,
      );
      if (!value) return null;
      if (value.length < 10) {
        await stepChat.prompt(messages.quest.invalidDescription, { parse_mode: "Markdown" });
        return null;
      }
      return { description: value };
    }
    case "proofInstructions": {
      const value = await askTextStep(
        conversation,
        ctx,
        stepChat,
        messages.quest.promptProofInstructions,
      );
      if (!value) return null;
      if (value.length < 5) {
        await stepChat.prompt(messages.quest.invalidProofInstructions, { parse_mode: "Markdown" });
        return null;
      }
      return { proofInstructions: value };
    }
    case "reward": {
      const value = await askNumber(
        conversation,
        ctx,
        stepChat,
        messages.quest.promptReward,
        messages.quest.invalidReward,
        parsePositiveNumber,
      );
      return value === null ? null : { rewardAmount: value };
    }
    case "slots": {
      const value = await askNumber(
        conversation,
        ctx,
        stepChat,
        messages.quest.promptSlots,
        messages.quest.invalidSlots,
        parsePositiveInt,
      );
      return value === null ? null : { totalSlots: value };
    }
    case "deadline": {
      await stepChat.prompt(messages.quest.promptDeadline, {
        parse_mode: "Markdown",
        reply_markup: cancelStepKeyboard(),
      });
      while (true) {
        const text = await waitForTextOrCancel(conversation, ctx, {
          timeoutMs: STEP_TIMEOUT_MS,
          timeoutMessage: messages.quest.edit.timeout,
          stepChat,
        });
        if (!text) return null;
        const deadline = parseDeadline(text);
        if (deadline) return { deadline };
        await stepChat.prompt(messages.quest.invalidDeadline, { reply_markup: cancelStepKeyboard() });
      }
    }
    case "category": {
      const category = await waitForCategory(conversation, ctx, stepChat);
      return category ? { category } : null;
    }
    case "proofType": {
      const proofType = await waitForProofType(conversation, ctx, stepChat);
      return proofType ? { proofType } : null;
    }
    default:
      return null;
  }
}

export function createEditQuestConversation(api: ApiClient) {
  return async function editQuestConversation(
    conversation: Conversation<BotContext, BotContext>,
    ctx: BotContext,
  ) {
    const from = ctx.from;
    if (!from) {
      await ctx.reply(messages.errors.noTelegramProfile);
      return;
    }
    const telegramId = String(from.id);

    const questId = await conversation.external((outerCtx) => {
      const id = outerCtx.session.editQuestId;
      outerCtx.session.editQuestId = undefined;
      return id;
    });

    if (!questId) {
      await ctx.reply(messages.quest.edit.notFound, { reply_markup: creatorHubKeyboard() });
      return;
    }

    let user;
    try {
      user = await conversation.external(() => api.getUserByTelegramId(telegramId));
    } catch (error) {
      console.error("Edit quest user lookup failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
      return;
    }

    if (!user || !isCreatorRole(user.role)) {
      await ctx.reply(messages.quest.notCreator, { parse_mode: "Markdown" });
      return;
    }

    let quest: ApiQuest | undefined;
    try {
      const quests = await conversation.external(() => api.listCreatorQuests(telegramId));
      quest = quests.find((item) => item.id === questId);
    } catch (error) {
      console.error("Edit quest load failed:", error);
      await ctx.reply(messages.quest.listFailed, { reply_markup: creatorHubKeyboard() });
      return;
    }

    if (!quest) {
      await ctx.reply(messages.quest.edit.notFound, { reply_markup: creatorHubKeyboard() });
      return;
    }
    if (quest.status !== "DRAFT") {
      await ctx.reply(messages.quest.edit.notDraft, { reply_markup: creatorHubKeyboard() });
      return;
    }

    const stepChat = new StepChat(ctx);

    while (true) {
      await stepChat.clearPrompts();
      await stepChat.prompt(formatOverview(quest), {
        parse_mode: "Markdown",
        reply_markup: editFieldsKeyboard(),
      });

      const field = await waitForEditField(conversation, ctx, stepChat);
      if (field === null) return; // timed out
      if (field === "done") break;

      const patch = await collectFieldValue(conversation, ctx, stepChat, field);
      if (!patch) continue; // step cancelled or locally invalid — back to the menu

      try {
        quest = await conversation.external(() => api.updateQuest(telegramId, questId, patch));
      } catch (error) {
        const code = (error as Error & { code?: string }).code;
        if (code === "QUEST_NOT_FOUND") {
          await ctx.reply(messages.quest.edit.notFound, { reply_markup: creatorHubKeyboard() });
          return;
        }
        if (code === "INVALID_STATUS") {
          await ctx.reply(messages.quest.edit.notDraft, { reply_markup: creatorHubKeyboard() });
          return;
        }
        console.error("Quest update failed:", error);
        await stepChat.prompt(messages.quest.edit.updateFailed);
      }
    }

    await ctx.reply(messages.quest.edit.done(quest.title), {
      parse_mode: "Markdown",
      reply_markup: creatorHubKeyboard(),
    });
  };
}
