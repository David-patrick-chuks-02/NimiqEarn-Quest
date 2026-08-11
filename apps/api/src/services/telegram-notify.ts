/**
 * Minimal Telegram notifier: lets the API push or edit a message via the Bot API.
 * Best-effort — never throws. Used for payouts and in-place Creator Hub balance updates.
 */
export function createTelegramNotifier(botToken?: string) {
  return {
    enabled: Boolean(botToken),

    async notify(
      telegramId: string,
      text: string,
      opts: { markdown?: boolean } = {},
    ): Promise<boolean> {
      if (!botToken) return false;
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramId,
            text,
            ...(opts.markdown ? { parse_mode: "Markdown" } : {}),
            disable_web_page_preview: true,
          }),
        });
        if (!res.ok) {
          console.error("Telegram notify failed:", res.status, await res.text().catch(() => ""));
        }
        return res.ok;
      } catch (error) {
        console.error("Telegram notify error:", error);
        return false;
      }
    },

    /** Edit an existing chat message in place (keeps its inline keyboard if markup omitted). */
    async editMessage(
      telegramId: string,
      messageId: number,
      text: string,
      opts: { markdown?: boolean } = {},
    ): Promise<boolean> {
      if (!botToken) return false;
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramId,
            message_id: messageId,
            text,
            ...(opts.markdown ? { parse_mode: "Markdown" } : {}),
            disable_web_page_preview: true,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          // "message is not modified" is fine — treat as success.
          if (body.includes("message is not modified")) return true;
          console.error("Telegram editMessage failed:", res.status, body);
          return false;
        }
        return true;
      } catch (error) {
        console.error("Telegram editMessage error:", error);
        return false;
      }
    },
  };
}

export type TelegramNotifier = ReturnType<typeof createTelegramNotifier>;
