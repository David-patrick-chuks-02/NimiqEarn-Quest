import { InlineKeyboard } from "grammy";
import type { ApiClient } from "../api/client.js";
import type { DiscoverQuest } from "../api/types.js";
import type { BotContext } from "../context.js";
import { messages } from "../copy/messages.js";
import { editOrReply } from "../utils/edit-or-reply.js";
import { CATEGORY_LABELS } from "../conversations/quest-keyboards.js";
import { escapeMarkdown } from "../utils/markdown.js";

export const BROWSE_CALLBACKS = {
  all: "browse:cat:",
  page: "browse:page:",
} as const;

const BROWSE_CATEGORIES = [
  { value: "", label: "All" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "SOCIAL_CAMPAIGN", label: "Social" },
  { value: "CONTENT", label: "Content" },
  { value: "REFERRAL", label: "Referral" },
  { value: "BUG_BOUNTY", label: "Bugs" },
  { value: "PRODUCT_TESTING", label: "Testing" },
] as const;

const PAGE_SIZE = 5;

function earnBaseUrl(): string | null {
  const base = (process.env.WEB_PUBLIC_URL ?? "").replace(/\/$/, "");
  return base.startsWith("https://") ? base : null;
}

function parseBrowseCallback(data: string): { category: string; page: number } | null {
  // browse:page:<categoryOr_->:<page>
  if (!data.startsWith(BROWSE_CALLBACKS.page)) return null;
  const rest = data.slice(BROWSE_CALLBACKS.page.length);
  const sep = rest.lastIndexOf(":");
  if (sep < 0) return null;
  const rawCat = rest.slice(0, sep);
  const page = Number(rest.slice(sep + 1));
  if (!Number.isInteger(page) || page < 0) return null;
  return { category: rawCat === "_" ? "" : rawCat, page };
}

export function formatBrowseList(
  quests: DiscoverQuest[],
  opts: { category: string; page: number; pageCount: number; total: number },
): string {
  const catLabel = opts.category
    ? (CATEGORY_LABELS[opts.category as keyof typeof CATEGORY_LABELS] ?? opts.category)
    : "All categories";

  const lines = [
    "*Browse quests*",
    `_${escapeMarkdown(catLabel)}_ · ${opts.total} open`,
    "",
  ];

  if (quests.length === 0) {
    lines.push("No open quests in this category yet. Try *All* or check back soon.");
    return lines.join("\n");
  }

  for (const q of quests) {
    const reward = Number(q.rewardAmount).toLocaleString();
    const cat = CATEGORY_LABELS[q.category as keyof typeof CATEGORY_LABELS] ?? q.category;
    lines.push(
      `• *${escapeMarkdown(q.title)}*`,
      `  ${escapeMarkdown(cat)} · *${reward} NIM* · ${q.slotsLeft} slots`,
      "",
    );
  }

  if (opts.pageCount > 1) {
    lines.push(`Page ${opts.page + 1} of ${opts.pageCount}`);
  }

  lines.push("_Open a quest below, or use *Full marketplace* for filters._");
  return lines.join("\n");
}

export function browseKeyboard(
  quests: DiscoverQuest[],
  opts: { category: string; page: number; pageCount: number },
) {
  const kb = new InlineKeyboard();
  const catKey = opts.category || "_";
  const base = earnBaseUrl();

  // Category chips
  for (let i = 0; i < BROWSE_CATEGORIES.length; i += 3) {
    const row = BROWSE_CATEGORIES.slice(i, i + 3);
    for (const c of row) {
      const active = (c.value || "") === opts.category;
      kb.text(
        `${active ? "· " : ""}${c.label}`,
        `${BROWSE_CALLBACKS.page}${c.value || "_"}:0`,
      );
    }
    kb.row();
  }

  // Per-quest open buttons (Mini App when HTTPS is available)
  for (const q of quests.slice(0, PAGE_SIZE)) {
    const label = q.title.length > 28 ? `${q.title.slice(0, 28)}…` : q.title;
    if (base) {
      kb.webApp(label, `${base}/quest/${q.id}`).row();
    } else {
      kb.text(label, `browse:quest:${q.id}`).row();
    }
  }

  // Pagination
  if (opts.pageCount > 1) {
    if (opts.page > 0) {
      kb.text("← Prev", `${BROWSE_CALLBACKS.page}${catKey}:${opts.page - 1}`);
    }
    if (opts.page < opts.pageCount - 1) {
      kb.text("Next →", `${BROWSE_CALLBACKS.page}${catKey}:${opts.page + 1}`);
    }
    kb.row();
  }

  if (base) {
    const market =
      opts.category !== ""
        ? `${base}/earn?category=${encodeURIComponent(opts.category)}`
        : `${base}/earn`;
    kb.webApp("Full marketplace", market).row();
  }

  kb.text("Main Menu", "menu:home");
  return kb;
}

/** In-chat categorized quest browse + Mini App deep links. */
export async function sendBrowseQuests(
  ctx: BotContext,
  api: ApiClient,
  opts: { category?: string; page?: number } = {},
) {
  const category = opts.category ?? "";
  const page = opts.page ?? 0;
  const telegramId = ctx.from ? String(ctx.from.id) : undefined;

  const data = await api.discoverQuests({
    page,
    pageSize: PAGE_SIZE,
    ...(category ? { category } : {}),
    telegramId,
  });

  const text = formatBrowseList(data.quests, {
    category,
    page: data.page,
    pageCount: data.pageCount,
    total: data.total,
  });

  await editOrReply(ctx, text, {
    parse_mode: "Markdown",
    reply_markup: browseKeyboard(data.quests, {
      category,
      page: data.page,
      pageCount: data.pageCount,
    }),
  });
}

export function registerBrowseHandlers(bot: import("grammy").Bot<BotContext>, api: ApiClient) {
  bot.callbackQuery(new RegExp(`^${BROWSE_CALLBACKS.page}`), async (ctx) => {
    await ctx.answerCallbackQuery();
    const parsed = parseBrowseCallback(ctx.callbackQuery.data ?? "");
    if (!parsed) return;
    try {
      await sendBrowseQuests(ctx, api, parsed);
    } catch (error) {
      console.error("Browse quests failed:", error);
      await ctx.reply(messages.errors.apiUnavailable);
    }
  });

  // Dev fallback when WEB_PUBLIC_URL isn't HTTPS — point them at /quests setup.
  bot.callbackQuery(/^browse:quest:/, async (ctx) => {
    await ctx.answerCallbackQuery({
      text: "Open Browse quests from an HTTPS web app URL to complete quests.",
      show_alert: true,
    });
  });
}
