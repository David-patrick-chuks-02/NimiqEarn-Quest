import type { VerificationOutcome } from "@nimiqearn/shared";

export type ProofType =
  | "TEXT"
  | "LINK"
  | "SCREENSHOT"
  | "TRANSACTION_HASH"
  | "REFERRAL_EVENT";

export interface RuleCheck {
  code: string;
  passed: boolean;
  message: string;
}

export interface RuleResult {
  passed: boolean;
  checks: RuleCheck[];
  /** When rules fail hard, decision should REJECT without AI. */
  hardFail: boolean;
}

const ALLOWED_IMAGE = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

function check(
  code: string,
  passed: boolean,
  message: string,
): RuleCheck {
  return { code, passed, message };
}

/**
 * Layer 1 deterministic verification — format and objective proof checks.
 * Failures here usually mean REJECT without spending AI budget.
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
      const mimeOk = ALLOWED_IMAGE.test(proof);
      checks.push(
        check("screenshot_mime", mimeOk, "Screenshot must be a JPEG, PNG, or WebP data URL."),
      );
      checks.push(
        check("screenshot_size", proof.length <= 700_000, "Screenshot is too large."),
      );
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

  const passed = checks.every((c) => c.passed);
  return { passed, checks, hardFail: !passed };
}

/** Map a hard rule failure to the architecture REJECT outcome. */
export function ruleFailOutcome(): VerificationOutcome {
  return "REJECT";
}
