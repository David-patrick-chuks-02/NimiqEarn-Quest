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
