/** Escape dynamic text for Telegram MarkdownV1-style messages. */
export function escapeMarkdown(text: string) {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
