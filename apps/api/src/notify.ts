type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; copy_text: { text: string } };
export type InlineKeyboardMarkup = { inline_keyboard: InlineButton[][] };

/** Best-effort Telegram message from the API (e.g. to confirm a wallet was linked). */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
      reply_markup: replyMarkup,
    }),
  });
  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed (${response.status})`);
  }
}

/** Edit a message the bot previously sent (e.g. turn the link prompt into a confirmation). */
export async function editTelegramMessage(
  botToken: string,
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
      reply_markup: replyMarkup,
    }),
  });
  if (!response.ok) {
    throw new Error(`Telegram editMessageText failed (${response.status})`);
  }
}
