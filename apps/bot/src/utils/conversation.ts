import type { BotContext } from "../context.js";

export function hasActiveConversation(ctx: BotContext): boolean {
  return Object.values(ctx.conversation.active()).some((count) => count > 0);
}
