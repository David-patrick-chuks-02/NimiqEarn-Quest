import type { VerificationOutcome } from "@nimiqearn/shared";

export type ProofType =
  | "TEXT"
  | "LINK"
  | "SCREENSHOT"
  | "TRANSACTION_HASH"
  | "REFERRAL_EVENT"
  | "WALLET_INTERACTION"
  | "UPLOADED_MEDIA";

export interface RuleCheck {
  code: string;
  passed: boolean;
  message: string;
  /** Soft failures escalate to review instead of hard REJECT. */
  soft?: boolean;
}

export interface RuleResult {
  passed: boolean;
  checks: RuleCheck[];
  /** When true, decision should REJECT without AI. */
  hardFail: boolean;
}

const ALLOWED_IMAGE = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const ALLOWED_MEDIA =
  /^data:(image\/(jpeg|jpg|png|webp)|video\/(mp4|webm|quicktime));base64,/i;

function check(
  code: string,
  passed: boolean,
  message: string,
  soft = false,
): RuleCheck {
  return soft ? { code, passed, message, soft: true } : { code, passed, message };
}

function finalize(checks: RuleCheck[]): RuleResult {
  const hardFail = checks.some((c) => !c.passed && !c.soft);
  const passed = !hardFail;
  return { passed, checks, hardFail };
}

/**
 * Layer 1 deterministic verification — format and objective proof checks.
 */
export function runRuleEngine(input: {
  proofType: ProofType | string;
  proof: string;
}): RuleResult {
  const proof = input.proof.trim();
  const checks: RuleCheck[] = [];

  checks.push(check("non_empty", proof.length > 0, "Proof must not be empty."));

  if (proof.length === 0) {
    return { passed: false, checks, hardFail: true };
  }

  switch (input.proofType) {
    case "SCREENSHOT": {
      checks.push(
        check("screenshot_mime", ALLOWED_IMAGE.test(proof), "Screenshot must be a JPEG, PNG, or WebP data URL."),
      );
      checks.push(check("screenshot_size", proof.length <= 700_000, "Screenshot is too large."));
      break;
    }
    case "UPLOADED_MEDIA": {
      checks.push(
        check(
          "media_mime",
          ALLOWED_MEDIA.test(proof),
          "Upload a JPEG/PNG/WebP image or MP4/WebM video data URL.",
        ),
      );
      checks.push(check("media_size", proof.length <= 2_500_000, "Media upload is too large."));
      break;
    }
    case "LINK": {
      let urlOk = false;
      try {
        const u = new URL(proof);
        urlOk = u.protocol === "http:" || u.protocol === "https:";
      } catch {
        urlOk = false;
      }
      checks.push(check("link_https", urlOk, "Enter a valid http(s) link."));
      checks.push(check("link_length", proof.length <= 2000, "Link is too long."));
      checks.push(
        check("link_not_data", !proof.startsWith("data:"), "This quest needs a link, not an image."),
      );
      break;
    }
    case "TRANSACTION_HASH": {
      const hexOk = /^[a-fA-F0-9]+$/.test(proof) && proof.length >= 8 && proof.length <= 200;
      checks.push(check("tx_hash_format", hexOk, "Enter a valid transaction hash."));
      checks.push(
        check("tx_not_data", !proof.startsWith("data:"), "Transaction hash cannot be an image."),
      );
      break;
    }
    case "WALLET_INTERACTION": {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(proof);
      } catch {
        parsed = null;
      }
      const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
      const hasFields =
        !!obj &&
        typeof obj.message === "string" &&
        typeof obj.publicKey === "string" &&
        typeof obj.signature === "string" &&
        (typeof obj.address === "string" || obj.address === undefined);
      checks.push(
        check(
          "wallet_json",
          hasFields,
          'Wallet proof must be JSON: {"message","publicKey","signature","address?"}.',
        ),
      );
      break;
    }
    case "REFERRAL_EVENT": {
      checks.push(
        check(
          "referral_length",
          proof.length >= 3 && proof.length <= 2000,
          "Referral proof must be between 3 and 2000 characters.",
        ),
      );
      checks.push(
        check(
          "referral_not_image",
          !proof.startsWith("data:image/"),
          "Referral proof cannot be an image upload.",
        ),
      );
      break;
    }
    case "TEXT":
    default: {
      checks.push(
        check(
          "text_length",
          proof.length >= 1 && proof.length <= 2000,
          "Text proof must be between 1 and 2000 characters.",
        ),
      );
      checks.push(
        check(
          "text_not_image",
          !proof.startsWith("data:image/"),
          "This quest needs text proof, not an image.",
        ),
      );
      break;
    }
  }

  return finalize(checks);
}

export function appendRuleChecks(base: RuleResult, extra: RuleCheck[]): RuleResult {
  return finalize([...base.checks, ...extra]);
}

export function softCheck(code: string, passed: boolean, message: string): RuleCheck {
  return check(code, passed, message, true);
}

export function hardCheck(code: string, passed: boolean, message: string): RuleCheck {
  return check(code, passed, message, false);
}

export function ruleFailOutcome(): VerificationOutcome {
  return "REJECT";
}

export function extractHashtags(text: string): string[] {
  const found = text.matchAll(/#([a-zA-Z0-9_]{2,64})/g);
  const out = new Set<string>();
  for (const m of found) out.add(m[1]!.toLowerCase());
  return [...out];
}

export function extractMentions(text: string): string[] {
  const found = text.matchAll(/@([a-zA-Z0-9_]{2,64})/g);
  const out = new Set<string>();
  for (const m of found) out.add(m[1]!.toLowerCase());
  return [...out];
}
