import { createHash } from "node:crypto";
import { fetchNimiqTransaction, verifyNimiqSignedMessage } from "@nimiqearn/nimiq";
import {
  extractHashtags,
  extractMentions,
  hardCheck,
  softCheck,
  type RuleCheck,
} from "@nimiqearn/verification";
import type { VerificationConfig } from "@nimiqearn/shared";
import { fetchSocialPost } from "./social-fetch.js";

export function parseVerificationConfig(raw: unknown): VerificationConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const cfg: VerificationConfig = {};
  if (typeof o.targetAddress === "string") cfg.targetAddress = o.targetAddress;
  if (typeof o.minAmountNim === "number") cfg.minAmountNim = o.minAmountNim;
  if (Array.isArray(o.requiredHashtags)) {
    cfg.requiredHashtags = o.requiredHashtags.filter((h): h is string => typeof h === "string");
  }
  if (Array.isArray(o.requiredMentions)) {
    cfg.requiredMentions = o.requiredMentions.filter((h): h is string => typeof h === "string");
  }
  if (typeof o.minEngagement === "number") cfg.minEngagement = o.minEngagement;
  if (typeof o.minReputation === "number") cfg.minReputation = o.minReputation;
  if (typeof o.expectedMessage === "string") cfg.expectedMessage = o.expectedMessage;
  if (typeof o.senderMustMatchWorker === "boolean") {
    cfg.senderMustMatchWorker = o.senderMustMatchWorker;
  }
  if (typeof o.livePostUrl === "string") cfg.livePostUrl = o.livePostUrl;
  if (typeof o.requireFirstQuest === "boolean") cfg.requireFirstQuest = o.requireFirstQuest;
  if (o.deadlineAt) {
    const d = new Date(o.deadlineAt as string | number | Date);
    if (!Number.isNaN(d.getTime())) cfg.deadlineAt = d;
  }
  return Object.keys(cfg).length ? cfg : undefined;
}

function normalizeAddress(addr: string): string {
  return addr.replace(/\s+/g, "").toUpperCase();
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function enrichOnChainChecks(input: {
  proof: string;
  rpcUrl?: string;
  config?: VerificationConfig;
  workerAddress?: string | null;
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

  // Default: transaction must originate from the worker's linked wallet when we have one.
  // Set senderMustMatchWorker=false in verificationConfig to opt out.
  const requireSender =
    input.workerAddress != null &&
    input.workerAddress.length > 0 &&
    cfg?.senderMustMatchWorker !== false;
  if (requireSender && input.workerAddress) {
    const ok = normalizeAddress(tx.from) === normalizeAddress(input.workerAddress);
    checks.push(
      hardCheck(
        "tx_sender",
        ok,
        ok
          ? "Sender matches worker wallet."
          : "Sender does not match the worker's linked wallet.",
      ),
    );
  } else if (!input.workerAddress) {
    checks.push(
      softCheck(
        "tx_sender",
        false,
        "Worker has no linked wallet — cannot bind tx to submitter.",
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

export function enrichWalletInteractionChecks(input: {
  proof: string;
  config?: VerificationConfig;
  workerAddress?: string | null;
}): RuleCheck[] {
  const checks: RuleCheck[] = [];
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(input.proof) as Record<string, unknown>;
  } catch {
    return [hardCheck("wallet_json", false, "Invalid wallet interaction JSON.")];
  }

  const message = String(parsed.message ?? "");
  const publicKey = String(parsed.publicKey ?? "");
  const signature = String(parsed.signature ?? "");
  let usedAddress =
    typeof parsed.address === "string" && parsed.address.length > 0
      ? parsed.address
      : input.workerAddress ?? "";

  if (!usedAddress) {
    return [
      hardCheck(
        "wallet_address",
        false,
        "Wallet proof needs an address (or a linked worker wallet).",
      ),
    ];
  }

  const ok = verifyNimiqSignedMessage({
    address: usedAddress,
    message,
    publicKey,
    signature,
  });

  checks.push(
    hardCheck(
      "wallet_signature",
      ok,
      ok ? "Signed message verified." : "Invalid Nimiq signed message.",
    ),
  );

  if (input.config?.expectedMessage) {
    const match = message.trim() === input.config.expectedMessage.trim();
    checks.push(
      hardCheck(
        "wallet_message",
        match,
        match ? "Signed message matches campaign." : "Signed message does not match expected text.",
      ),
    );
  }

  if (input.config?.senderMustMatchWorker !== false && input.workerAddress && usedAddress) {
    const match = normalizeAddress(usedAddress) === normalizeAddress(input.workerAddress);
    checks.push(
      hardCheck(
        "wallet_sender",
        match,
        match ? "Signer matches worker wallet." : "Signer does not match worker wallet.",
      ),
    );
  } else if (!input.workerAddress) {
    checks.push(
      softCheck(
        "wallet_sender",
        false,
        "Worker has no linked wallet — cannot bind signature to submitter.",
      ),
    );
  }

  if (input.config?.deadlineAt) {
    const okDeadline = Date.now() <= input.config.deadlineAt.getTime();
    checks.push(
      hardCheck(
        "wallet_deadline",
        okDeadline,
        okDeadline ? "Within campaign deadline." : "Campaign deadline has passed.",
      ),
    );
  }

  return checks;
}

export async function enrichSocialChecks(input: {
  proof: string;
  proofInstructions: string;
  config?: VerificationConfig;
}): Promise<{ checks: RuleCheck[]; livePostText: string }> {
  const checks: RuleCheck[] = [];

  const snap = await fetchSocialPost(input.proof);

  if (snap.deleted || (!snap.exists && snap.source !== "error")) {
    checks.push(hardCheck("link_reachable", false, "Post appears deleted or not found."));
    return { checks, livePostText: "" };
  }

  if (snap.source === "error") {
    checks.push(
      softCheck(
        "link_reachable",
        false,
        "Could not fetch the link (timeout or blocked) — escalated to review.",
      ),
    );
    return { checks, livePostText: "" };
  }

  checks.push(
    hardCheck(
      "link_reachable",
      snap.exists && snap.isPublic,
      snap.isPublic ? "Link/post is publicly reachable." : "Post does not appear public.",
    ),
  );

  const requiredTags =
    input.config?.requiredHashtags?.map((h) => h.replace(/^#/, "").toLowerCase()) ??
    extractHashtags(input.proofInstructions);
  if (requiredTags.length > 0) {
    const missing = requiredTags.filter(
      (t) => !snap.hashtags.includes(t) && !snap.text.toLowerCase().includes(`#${t}`),
    );
    checks.push(
      softCheck(
        "link_hashtags",
        missing.length === 0,
        missing.length === 0
          ? "Required hashtags found."
          : `Missing hashtags: ${missing.map((t) => `#${t}`).join(", ")}`,
      ),
    );
  }

  const requiredMentions =
    input.config?.requiredMentions?.map((m) => m.replace(/^@/, "").toLowerCase()) ??
    extractMentions(input.proofInstructions);
  if (requiredMentions.length > 0) {
    const missing = requiredMentions.filter(
      (m) => !snap.mentions.includes(m) && !snap.text.toLowerCase().includes(`@${m}`),
    );
    checks.push(
      softCheck(
        "link_mentions",
        missing.length === 0,
        missing.length === 0
          ? "Required mentions found."
          : `Missing mentions: ${missing.map((m) => `@${m}`).join(", ")}`,
      ),
    );
  }

  if (input.config?.minEngagement != null) {
    checks.push(
      softCheck(
        "link_engagement",
        false,
        "Engagement metrics unavailable without a paid X API — escalated to review.",
      ),
    );
  }

  return { checks, livePostText: snap.text };
}

export function enrichReferralChecks(input: {
  workerTelegramId: string;
  proof: string;
  referred: { telegramId: string; status: string; id: string; referredById?: string | null } | null;
  referredHasActivity: boolean;
  referredCompletedQuest: boolean;
  requireFirstQuest?: boolean;
  farmingClusterSize: number;
  /** True when referred account shares device fingerprint with referrer. */
  sharedDeviceWithReferrer?: boolean;
  /** How many referral edges already point at this referred user. */
  inboundReferralCount?: number;
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

  // Unique edge in the graph: already referred by someone else → reject farming reuse.
  if (
    input.referred.referredById &&
    input.referred.referredById.length > 0 &&
    input.inboundReferralCount != null &&
    input.inboundReferralCount > 0
  ) {
    // Allow if they were already referred by this same worker (inbound still counts).
  }
  if ((input.inboundReferralCount ?? 0) > 1) {
    checks.push(
      hardCheck(
        "referral_unique",
        false,
        "Referred user already appears in multiple referral edges (possible farming).",
      ),
    );
  } else {
    checks.push(hardCheck("referral_unique", true, "Referral edge looks unique."));
  }

  if (input.sharedDeviceWithReferrer) {
    checks.push(
      softCheck(
        "referral_shared_device",
        false,
        "Referrer and referred share a device fingerprint — possible Sybil pair.",
      ),
    );
  } else {
    checks.push(softCheck("referral_shared_device", true, "No shared device signal."));
  }

  checks.push(
    softCheck(
      "referral_activity",
      input.referredHasActivity,
      input.referredHasActivity
        ? "Referred user has platform activity."
        : "Referred user has little activity yet — escalated to review.",
    ),
  );

  if (input.requireFirstQuest) {
    checks.push(
      hardCheck(
        "referral_first_quest",
        input.referredCompletedQuest,
        input.referredCompletedQuest
          ? "Referred user completed a quest."
          : "Referred user has not completed a first quest yet.",
      ),
    );
  }

  const clusterOk = input.farmingClusterSize < 8;
  checks.push(
    softCheck(
      "referral_farm_cluster",
      clusterOk,
      clusterOk
        ? "Referral cluster size looks normal."
        : `Possible referral farming cluster (${input.farmingClusterSize} edges).`,
    ),
  );

  return checks;
}

export function behavioralRiskFromCounts(input: {
  submissionsLastHour: number;
  submissionsLastDay: number;
  distinctQuestsLastHour: number;
  sharedFingerprintUsers: number;
  sharedIpUsers: number;
  contentClusterUsers: number;
}): { risk: number; checks: RuleCheck[] } {
  const checks: RuleCheck[] = [];
  let risk = 0;

  if (input.submissionsLastHour >= 12) {
    risk = Math.max(risk, 0.85);
    checks.push(softCheck("behavior_burst", false, "Very high submission rate in the last hour."));
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

  if (input.sharedFingerprintUsers >= 4) {
    risk = Math.max(risk, 0.8);
    checks.push(
      softCheck(
        "behavior_device_cluster",
        false,
        `Device fingerprint shared by ${input.sharedFingerprintUsers} accounts.`,
      ),
    );
  }

  if (input.sharedIpUsers >= 6) {
    risk = Math.max(risk, 0.7);
    checks.push(
      softCheck("behavior_ip_cluster", false, `IP hash shared by ${input.sharedIpUsers} accounts.`),
    );
  }

  if (input.contentClusterUsers >= 5) {
    risk = Math.max(risk, 0.85);
    checks.push(
      softCheck(
        "behavior_content_cluster",
        false,
        `Same proof content used by ${input.contentClusterUsers} accounts.`,
      ),
    );
  }

  return { risk, checks };
}
