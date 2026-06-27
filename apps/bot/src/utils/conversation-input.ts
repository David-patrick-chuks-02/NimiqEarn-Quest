import type { Conversation } from "@grammyjs/conversations";
import { messages } from "../copy/messages.js";
import type { BotContext } from "../context.js";
import { cancelStepKeyboard, NAV_CANCEL } from "../menus/nav.js";
import type { StepChat } from "./chat-cleanup.js";

export async function waitForTextOrCancel(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
  options: {
    timeoutMs: number;
    timeoutMessage: string;
    stepChat?: StepChat;
    inputHint?: string;
  },
): Promise<string | null> {
  const update = await conversation.waitFor(["message:text", "callback_query:data"], {
    maxMilliseconds: options.timeoutMs,
    otherwise: async () => {
      await options.stepChat?.clearPrompts();
      await ctx.reply(options.timeoutMessage);
    },
  });

  if (update.callbackQuery?.data === NAV_CANCEL) {
    await update.answerCallbackQuery();
    await options.stepChat?.consumeCallback(update.callbackQuery.message?.message_id);
    return null;
  }

  if (update.callbackQuery) {
    await update.answerCallbackQuery();
    const hint = await update.reply(options.inputHint ?? messages.quest.inputHint, {
      parse_mode: "Markdown",
      reply_markup: cancelStepKeyboard(),
    });
    options.stepChat?.track(hint.message_id);
    return waitForTextOrCancel(conversation, ctx, options);
  }

  const text = update.message?.text?.trim() ?? null;
  await options.stepChat?.consumeUserInput(update.message?.message_id);
  return text;
}
