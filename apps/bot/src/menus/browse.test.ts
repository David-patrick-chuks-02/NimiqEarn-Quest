import { describe, expect, it } from "vitest";
import { formatBrowseList } from "./browse.js";

describe("formatBrowseList", () => {
  it("renders an empty category message", () => {
    const text = formatBrowseList([], {
      category: "FEEDBACK",
      page: 0,
      pageCount: 0,
      total: 0,
    });
    expect(text).toContain("Browse quests");
    expect(text).toContain("Feedback");
    expect(text).toContain("No open quests");
  });

  it("lists quests with reward and slots", () => {
    const text = formatBrowseList(
      [
        {
          id: "q1",
          title: "Share feedback",
          category: "FEEDBACK",
          rewardAmount: "50",
          totalSlots: 20,
          filledSlots: 2,
          slotsLeft: 18,
          promoted: false,
          proofType: "TEXT",
          viewCount: 3,
          creatorName: "Ada",
        },
      ],
      { category: "", page: 0, pageCount: 1, total: 1 },
    );
    expect(text).toContain("Share feedback");
    expect(text).toContain("50 NIM");
    expect(text).toContain("18 slots");
    expect(text).toContain("All categories");
  });
});
