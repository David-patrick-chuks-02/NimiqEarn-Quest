import { describe, expect, it, vi } from "vitest";
import { createProfileService, isProfileVerified } from "./profile.service.js";

describe("profile service", () => {
  it("treats ACTIVE users as verified", () => {
    expect(isProfileVerified({ status: "ACTIVE" })).toBe(true);
    expect(isProfileVerified({ status: "PENDING" })).toBe(false);
  });

  it("activates pending users after wallet link", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = createProfileService({ user: { updateMany } } as never);

    await service.activateAfterWalletLink("user-1");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", status: "PENDING" },
      data: { status: "ACTIVE" },
    });
  });

  it("rejects unverified users for protected actions", () => {
    const service = createProfileService({ user: { updateMany: vi.fn() } } as never);

    expect(() =>
      service.assertVerifiedProfile({
        id: "user-1",
        status: "PENDING",
        walletProfile: null,
      } as never),
    ).toThrow(expect.objectContaining({ code: "NOT_VERIFIED" }));
  });
});
