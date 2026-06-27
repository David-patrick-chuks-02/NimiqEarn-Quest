import type { CreatorDashboard } from "../api/types.js";

export function formatCreatorDashboard(dashboard: CreatorDashboard): string {
  const name = dashboard.user.displayName ?? "Creator";

  return [
    `*${name}'s creator dashboard*`,
    "",
    `Role: ${formatRole(dashboard.user.role)}`,
    `Account: ${formatStatus(dashboard.user.status)}`,
    "",
    `Draft quests: ${dashboard.quests.DRAFT}`,
    `Published quests: ${dashboard.quests.PUBLISHED}`,
    `Closed quests: ${dashboard.quests.CLOSED}`,
    "",
    "Tap *Create Quest* to draft a bounty, or *My Quests* to review drafts.",
  ].join("\n");
}

function formatRole(role: string) {
  if (role === "ADMIN") return "Admin";
  return "Creator";
}

function formatStatus(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "SUSPENDED":
      return "Suspended";
    default:
      return "Pending";
  }
}
