/**
 * Minimal Telegram notifier: lets the API push a message to a user by chat id via the Bot
 * API, using the bot token. Best-effort — never throws; returns whether the send succeeded.
 * Used to confirm payouts to workers in-chat. No-op when no bot token is configured.
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
  };
}

export type TelegramNotifier = ReturnType<typeof createTelegramNotifier>;
