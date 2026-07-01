/** Parsing and formatting helpers shared by the create-quest and edit-quest flows. */

export function parsePositiveNumber(text: string): number | null {
  const value = Number(text.trim().replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function parsePositiveInt(text: string): number | null {
  const value = parsePositiveNumber(text);
  if (value === null || !Number.isInteger(value)) return null;
  return value;
}

export function parseDeadline(text: string): Date | null {
  const trimmed = text.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59.000Z`)
    : new Date(trimmed);

  if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) {
    return null;
  }

  return parsed;
}

export function formatDeadline(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
