import { fetchNimiqTransaction } from "@nimiqearn/nimiq";
import {
  extractHashtags,
  hardCheck,
  softCheck,
  type RuleCheck,
} from "@nimiqearn/verification";
import type { VerificationConfig } from "@nimiqearn/shared";

export function parseVerificationConfig(raw: unknown): VerificationConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const cfg: VerificationConfig = {};
  if (typeof o.targetAddress === "string") cfg.targetAddress = o.targetAddress;
  if (typeof o.minAmountNim === "number") cfg.minAmountNim = o.minAmountNim;
  if (Array.isArray(o.requiredHashtags)) {
    cfg.requiredHashtags = o.requiredHashtags.filter((h): h is string => typeof h === "string");
  }
  if (typeof o.minReputation === "number") cfg.minReputation = o.minReputation;
  if (o.deadlineAt) {
    const d = new Date(o.deadlineAt as string | number | Date);
    if (!Number.isNaN(d.getTime())) cfg.deadlineAt = d;
  }
  return Object.keys(cfg).length ? cfg : undefined;
}

function normalizeAddress(addr: string): string {
  return addr.replace(/\s+/g, "").toUpperCase();
}

/**
 * On-chain enrichment: look up tx by hash and match recipient / amount / deadline.
 */
export async function enrichOnChainChecks(input: {
  proof: string;
  rpcUrl?: string;
  config?: VerificationConfig;
}): Promise<RuleCheck[]> {
  const checks: RuleCheck[] = [];
  if (!input.rpcUrl) {
    checks.push(
      softCheck(
        "tx_rpc_configured",
        false,
        "On-chain lookup unavailable (NIMIQ_RPC_URL unset) — escalated to review.",
      ),
    );
    return checks;
  }

  const tx = await fetchNimiqTransaction(input.rpcUrl, input.proof);
  if (!tx) {
    checks.push(
      hardCheck("tx_found", false, "Transaction not found on the configured Nimiq network."),
    );
    return checks;
  }
  checks.push(hardCheck("tx_found", true, "Transaction found on-chain."));

  const cfg = input.config;
  if (cfg?.targetAddress) {
    const ok = normalizeAddress(tx.to) === normalizeAddress(cfg.targetAddress);
    checks.push(
      hardCheck(
        "tx_recipient",
        ok,
        ok
          ? "Recipient matches campaign target."
          : `Recipient ${tx.to} does not match required address.`,
      ),
    );
  }

  if (cfg?.minAmountNim != null) {
    const ok = tx.valueNim + 1e-9 >= cfg.minAmountNim;
    checks.push(
      hardCheck(
        "tx_amount",
        ok,
        ok
          ? `Amount ${tx.valueNim} NIM meets minimum.`
          : `Amount ${tx.valueNim} NIM is below required ${cfg.minAmountNim} NIM.`,
      ),
    );
  }

  if (cfg?.deadlineAt && tx.timestamp != null) {
    // Nimiq timestamps are typically milliseconds; treat seconds if small.
    const tsMs = tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp;
    const ok = tsMs <= cfg.deadlineAt.getTime();
    checks.push(
      hardCheck(
        "tx_deadline",
        ok,
        ok ? "Transaction is within the campaign deadline." : "Transaction is after the deadline.",
      ),
    );
  }

  checks.push(
    softCheck("tx_network", true, "Verified against configured NIMIQ_RPC_URL network."),
  );

  return checks;
}

/**
 * Social link enrichment: HTTP fetchability + required hashtags.
 */
export async function enrichSocialChecks(input: {
  proof: string;
  proofInstructions: string;
  config?: VerificationConfig;
}): Promise<RuleCheck[]> {
  const checks: RuleCheck[] = [];
  let url: URL;
  try {
    url = new URL(input.proof.trim());
  } catch {
    return checks;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return checks;

  const required =
    input.config?.requiredHashtags?.map((h) => h.replace(/^#/, "").toLowerCase()) ??
    extractHashtags(input.proofInstructions);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  let status = 0;
  let body = "";
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "NimiqEarnQuest-Verifier/1.0",
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
    });
    status = res.status;
    body = (await res.text()).slice(0, 200_000);
  } catch {
    checks.push(
      softCheck(
        "link_reachable",
        false,
        "Could not fetch the link (timeout or blocked) — escalated to review.",
      ),
    );
    return checks;
  } finally {
    clearTimeout(timer);
  }

  if (status === 404 || status === 410) {
    checks.push(hardCheck("link_reachable", false, "Post appears deleted or not found."));
    return checks;
  }

  if (status < 200 || status >= 400) {
    checks.push(
      softCheck(
        "link_reachable",
        false,
        `Link returned HTTP ${status} — escalated to review.`,
      ),
    );
  } else {
    checks.push(hardCheck("link_reachable", true, "Link is publicly reachable."));
  }

  if (required.length > 0) {
    const lower = body.toLowerCase();
    const missing = required.filter((tag) => {
      const bare = tag.toLowerCase();
      return !lower.includes(`#${bare}`) && !lower.includes(bare);
    });
    // Many social sites don't return hashtag text to anonymous crawlers — soft-fail.
    const ok = missing.length === 0;
    checks.push(
      softCheck(
        "link_hashtags",
        ok,
        ok
          ? "Required hashtags found in fetched content."
          : `Missing hashtags in fetch: ${missing.map((t) => `#${t}`).join(", ")}`,
      ),
    );
  }

  return checks;
}

/**
 * Referral graph: no self-referral; referred Telegram user must exist and be ACTIVE.
 */
export function enrichReferralChecks(input: {
  workerTelegramId: string;
  proof: string;
  referred: { telegramId: string; status: string; id: string } | null;
  referredHasActivity: boolean;
}): RuleCheck[] {
  const checks: RuleCheck[] = [];
  const raw = input.proof.trim().replace(/^@/, "");
  const self =
    raw === input.workerTelegramId ||
    raw.toLowerCase() === `tg:${input.workerTelegramId}`.toLowerCase();

  checks.push(
    hardCheck("referral_not_self", !self, self ? "Self-referral is not allowed." : "Not a self-referral."),
  );

  if (!input.referred) {
    checks.push(
      hardCheck(
        "referral_user_exists",
        false,
        "Referred user not found — submit their Telegram user id.",
      ),
    );
    return checks;
  }
  checks.push(hardCheck("referral_user_exists", true, "Referred user exists."));

  const active = input.referred.status === "ACTIVE";
  checks.push(
    hardCheck(
      "referral_user_active",
      active,
      active ? "Referred user is active." : "Referred user has not completed onboarding.",
    ),
  );

  checks.push(
    softCheck(
      "referral_activity",
      input.referredHasActivity,
      input.referredHasActivity
        ? "Referred user has platform activity."
        : "Referred user has little activity yet — escalated to review.",
    ),
  );

  return checks;
}

/** Timing / rate farming signals → 0–1 risk score. */
export function behavioralRiskFromCounts(input: {
  submissionsLastHour: number;
  submissionsLastDay: number;
  distinctQuestsLastHour: number;
}): { risk: number; checks: RuleCheck[] } {
  const checks: RuleCheck[] = [];
  let risk = 0;

  if (input.submissionsLastHour >= 12) {
    risk = Math.max(risk, 0.85);
    checks.push(
      softCheck("behavior_burst", false, "Very high submission rate in the last hour."),
    );
  } else if (input.submissionsLastHour >= 6) {
    risk = Math.max(risk, 0.55);
    checks.push(softCheck("behavior_burst", false, "Elevated submission rate in the last hour."));
  } else {
    checks.push(softCheck("behavior_burst", true, "Submission rate looks normal."));
  }

  if (input.submissionsLastDay >= 40) {
    risk = Math.max(risk, 0.75);
    checks.push(softCheck("behavior_daily", false, "Unusually high daily submission volume."));
  }

  if (input.distinctQuestsLastHour >= 8 && input.submissionsLastHour >= 8) {
    risk = Math.max(risk, 0.7);
    checks.push(
      softCheck("behavior_batch_farm", false, "Possible batch farming across many quests."),
    );
  }

  return { risk, checks };
}
