import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTelegramNotifier } from "./telegram-notify.js";

describe("createTelegramNotifier", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is disabled when no bot token is configured", async () => {
    const notifier = createTelegramNotifier(undefined);
    expect(notifier.enabled).toBe(false);
    await expect(notifier.notify("1", "hi")).resolves.toBe(false);
    await expect(notifier.editMessage("1", 9, "hi")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("notify posts sendMessage to Telegram", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
    const notifier = createTelegramNotifier("tok");
    await expect(notifier.notify("123", "Hello", { markdown: true })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottok/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: "123",
          text: "Hello",
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }),
    );
  });

  it("editMessage posts editMessageText to Telegram", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
    const notifier = createTelegramNotifier("tok");
    await expect(notifier.editMessage("123", 55, "*Balance:* 1 NIM", { markdown: true })).resolves.toBe(
      true,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottok/editMessageText",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: "123",
          message_id: 55,
          text: "*Balance:* 1 NIM",
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }),
    );
  });

  it("editMessage treats 'message is not modified' as success", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ description: "Bad Request: message is not modified" }),
    });
    const notifier = createTelegramNotifier("tok");
    await expect(notifier.editMessage("123", 55, "same")).resolves.toBe(true);
  });

  it("editMessage returns false on other Telegram errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ description: "message to edit not found" }),
    });
    const notifier = createTelegramNotifier("tok");
    await expect(notifier.editMessage("123", 55, "x")).resolves.toBe(false);
  });
});
