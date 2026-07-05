/** Best-effort Telegram message from the API (e.g. to confirm a wallet was linked). */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    }),
  });
  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed (${response.status})`);
  }
}
