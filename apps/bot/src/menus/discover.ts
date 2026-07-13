import { InlineKeyboard } from "grammy";
import type { DiscoverPage } from "../api/types.js";
import { escapeMarkdown } from "../utils/markdown.js";

/** Pagination callback: `discover:page:<n>`. */
export const DISCOVER_PAGE_PREFIX = "discover:page:";
// Main-menu callback (inlined to avoid an import cycle with menus/main.ts).
const MAIN_MENU_REFRESH = "menu:refresh";

/** Worker-facing quest Mini App URL — web_app buttons require HTTPS. */
function questMiniAppUrl(id: string): string | null {
  const base = (process.env.WEB_PUBLIC_URL ?? "").replace(/\/$/, "");
  return base.startsWith("https://") ? `${base}/quest/${id}` : null;
}

/** Public share-page URL (works over http) — fallback when web_app buttons aren't available. */
function questShareUrl(id: string): string | null {
  const base = (process.env.WEB_PUBLIC_URL ?? "").replace(/\/$/, "");
  return base ? `${base}/q/${id}` : null;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Message body listing the open quests on this page. */
export function formatDiscoverList(page: DiscoverPage): string {
  if (page.total === 0) {
    return ["*Browse quests*", "", "No open quests right now. Check back soon."].join("\n");
  }
  const lines = [
    "*Browse quests*",
    `${page.total} open ${page.total === 1 ? "quest" : "quests"} — tap one below to start earning.`,
    "",
  ];
  page.quests.forEach((q, i) => {
    const tag = q.promoted ? "[Promoted] " : "";
    const n = page.page * page.pageSize + i + 1;
    lines.push(`${n}. ${tag}*${escapeMarkdown(q.title)}*`);
    lines.push(
      `   ${Number(q.rewardAmount).toLocaleString()} NIM · ${q.slotsLeft} of ${q.totalSlots} left`,
    );
  });
  if (page.pageCount > 1) {
    lines.push("", `Page ${page.page + 1} of ${page.pageCount}`);
  }
  return lines.join("\n");
}

/** Inline keyboard: one web_app button per quest, plus pagination + Main Menu. */
export function discoverKeyboard(page: DiscoverPage): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (const q of page.quests) {
    const label = `${truncate(q.title, 24)} · ${Number(q.rewardAmount).toLocaleString()} NIM`;
    const appUrl = questMiniAppUrl(q.id);
    if (appUrl) {
      // Preferred: open the Mini App to do the quest (requires HTTPS).
      kb.webApp(label, appUrl).row();
    } else {
      // Fallback (non-HTTPS dev): a plain URL button to the public share page.
      const shareUrl = questShareUrl(q.id);
      if (shareUrl) kb.url(label, shareUrl).row();
    }
  }

  if (page.pageCount > 1) {
    if (page.page > 0) kb.text("Prev", `${DISCOVER_PAGE_PREFIX}${page.page - 1}`);
    if (page.page < page.pageCount - 1) kb.text("Next", `${DISCOVER_PAGE_PREFIX}${page.page + 1}`);
    kb.row();
  }

  // Refresh re-pulls the current page (the list is stale after completing a quest).
  kb.text("Refresh", `${DISCOVER_PAGE_PREFIX}${page.page}`).text("Main Menu", MAIN_MENU_REFRESH);
  return kb;
}
