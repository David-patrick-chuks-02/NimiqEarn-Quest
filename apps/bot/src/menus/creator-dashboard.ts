import type { CreatorDashboard } from "../api/types.js";
import { escapeMarkdown } from "../utils/markdown.js";

export function formatCreatorDashboard(dashboard: CreatorDashboard): string {
  const name = escapeMarkdown(dashboard.user.displayName ?? "Creator");

  return [
    "*Creator Hub*",
    `_${name}_`,
    "",
    "*Account*",
    `Role · ${formatRole(dashboard.user.role)}`,
    `Status · ${formatStatus(dashboard.user.status)}`,
    "",
    "*Quest summary*",
    `Draft · ${dashboard.quests.DRAFT}`,
    `Published · ${dashboard.quests.PUBLISHED}`,
    `Closed · ${dashboard.quests.CLOSED}`,
    "",
    "Use *Create Quest* to draft a new bounty, or *My Quests* to review and publish existing drafts.",
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
