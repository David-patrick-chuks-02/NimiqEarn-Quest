import type { BotContext } from "../context.js";

export async function deleteMessageSafe(
  ctx: BotContext,
  chatId: number | undefined,
  messageId: number | undefined,
) {
  if (!chatId || !messageId) return;
  try {
    await ctx.api.deleteMessage(chatId, messageId);
  } catch {
    // Message may already be gone or be too old to delete.
  }
}

export class StepChat {
  private pendingBotIds: number[] = [];

  constructor(private readonly ctx: BotContext) {}

  private get chatId(): number | undefined {
    return this.ctx.chat?.id;
  }

  track(messageId: number | undefined) {
    if (messageId !== undefined) {
      this.pendingBotIds.push(messageId);
    }
  }

  async prompt(text: string, options?: Parameters<BotContext["reply"]>[1]) {
    const message = await this.ctx.reply(text, options);
    this.track(message.message_id);
    return message;
  }

  async promptPhoto(
    photo: Parameters<BotContext["replyWithPhoto"]>[0],
    options?: Parameters<BotContext["replyWithPhoto"]>[1],
  ) {
    const message = await this.ctx.replyWithPhoto(photo, options);
    this.track(message.message_id);
    return message;
  }

  async clearPrompts() {
    const ids = [...this.pendingBotIds];
    this.pendingBotIds = [];
    await Promise.all(ids.map((id) => deleteMessageSafe(this.ctx, this.chatId, id)));
  }

  async consumeUserInput(userMessageId?: number) {
    await deleteMessageSafe(this.ctx, this.chatId, userMessageId);
    await this.clearPrompts();
  }

  async consumeCallback(callbackMessageId?: number) {
    const ids = new Set(this.pendingBotIds);
    if (callbackMessageId !== undefined) {
      ids.add(callbackMessageId);
    }
    this.pendingBotIds = [];
    await Promise.all([...ids].map((id) => deleteMessageSafe(this.ctx, this.chatId, id)));
  }
}
