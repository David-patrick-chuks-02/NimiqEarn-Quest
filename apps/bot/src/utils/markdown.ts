/**
 * Escape dynamic text for Telegram legacy "Markdown" (parse_mode: "Markdown").
 * Legacy Markdown only recognises these entity characters, so those are all we
 * escape — escaping the full MarkdownV2 set here would render literal backslashes.
 */
export function escapeMarkdown(text: string) {
  return text.replace(/([_*`[\\])/g, "\\$1");
}
