import type { CreatorDashboard } from "../api/types.js";
import { escapeMarkdown } from "../utils/markdown.js";

export function formatCreatorDashboard(dashboard: CreatorDashboard): string {
  const name = escapeMarkdown(dashboard.user.displayName ?? "Creator");

  return [
    "🎨 *Creator Hub*",
    `Welcome back, *${name}*`,
    "",
    "👤 *Account*",
    `• Role · ${formatRole(dashboard.user.role)}`,
    `• Status · ${formatStatus(dashboard.user.status)}`,
    "",
    "📊 *Your quests*",
    `• Draft · ${dashboard.quests.DRAFT}`,
    `• Published · ${dashboard.quests.PUBLISHED}`,
    `• Closed · ${dashboard.quests.CLOSED}`,
    "",
    "Open *Creator Studio* to create quests, publish drafts, and track performance.",
  ].join("\n");
}

function formatRole(role: string) {
  if (role === "ADMIN") return "Admin";
  return "Creator";
}

function formatStatus(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Verified";
    case "SUSPENDED":
      return "Suspended";
    default:
      return "Verification required";
  }
}
