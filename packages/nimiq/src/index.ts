import { Address } from "@nimiq/core";

export function validateNimiqAddress(address: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const trimmed = address.trim().replace(/\s+/g, "");

  if (!trimmed) {
    return { valid: false, error: "Address is required." };
  }

  try {
    const parsed = Address.fromUserFriendlyAddress(trimmed);
    return { valid: true, normalized: parsed.toUserFriendlyAddress() };
  } catch {
    return { valid: false, error: "Invalid Nimiq address." };
  }
}
