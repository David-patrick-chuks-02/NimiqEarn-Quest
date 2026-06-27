import { describe, expect, it } from "vitest";
import { formatCreatorDashboard } from "./creator-dashboard.js";

describe("formatCreatorDashboard", () => {
  it("formats creator quest counts", () => {
    const text = formatCreatorDashboard({
      user: {
        id: "user-1",
        telegramId: "123",
        displayName: "Quest Boss",
        role: "CREATOR",
        status: "ACTIVE",
      },
      quests: {
        total: 2,
        DRAFT: 1,
        PUBLISHED: 1,
        CLOSED: 0,
        ARCHIVED: 0,
      },
    });

    expect(text).toContain("Creator Hub");
    expect(text).toContain("Quest Boss");
    expect(text).toContain("Draft · 1");
    expect(text).toContain("Published · 1");
  });
});
