import { InlineKeyboard } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { WorkerEarnings } from "../api/types.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { editOrReply } from "../utils/edit-or-reply.js";
import { escapeMarkdown } from "../utils/markdown.js";

const STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "Paid",
  PENDING: "Pending",
  REJECTED: "Rejected",
};

/** My Earnings body: total earned + recent submissions with on-chain (NimiqWatch) links. */
export function formatEarnings(earnings: WorkerEarnings): string {
  if (earnings.count === 0) {
    return [
      "*My Earnings*",
      "",
      "You haven't completed any quests yet. Tap *Start Earning* to browse open quests.",
    ].join("\n");
  }
  const lines = [
    "*My Earnings*",
    `Total earned · *${earnings.totalEarned.toLocaleString()} NIM* from ${earnings.count} ${
      earnings.count === 1 ? "submission" : "submissions"
    }`,
    "",
  ];
  // Show the most recent 10.
  for (const s of earnings.submissions.slice(0, 10)) {
    const status = STATUS_LABELS[s.status] ?? s.status;
    const line = `• *${escapeMarkdown(s.questTitle)}* — ${s.reward.toLocaleString()} NIM · ${status}`;
    lines.push(s.payoutTxUrl ? `${line} · [tx](${s.payoutTxUrl})` : line);
  }
  return lines.join("\n");
}

export async function sendEarnings(ctx: BotContext, api: ApiClient) {
  const from = ctx.from;
  if (!from) {
    await ctx.reply(messages.errors.noTelegramProfile);
    return;
  }
  const earnings = await api.getWorkerSubmissions(String(from.id));
  const keyboard = new InlineKeyboard()
    .text("Start Earning", "menu:start-earning")
    .row()
    .text("Main Menu", "menu:refresh");
  await editOrReply(ctx, formatEarnings(earnings), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}
