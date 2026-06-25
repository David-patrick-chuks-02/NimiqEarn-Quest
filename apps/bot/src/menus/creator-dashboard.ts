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
    "Quest creation and publishing land in the next update.",
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
