import { MAX_SAMPLE_EVIDENCE_IMAGE_CHARS } from "@nimiqearn/shared/limits";
import type { EditableQuest, QuestForm } from "./types";

/**
 * Read an image File and return a compressed JPEG data URL that fits `maxChars`.
 *
 * Up to MAX_SAMPLE_EVIDENCE_UPLOADS sample images share one 1 MiB request body, so we shrink
 * the longest edge and drop JPEG quality until the image fits its share. Rejects non-images.
 */
export async function compressImage(
  file: File,
  maxChars: number = MAX_SAMPLE_EVIDENCE_IMAGE_CHARS,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    // Use the DOM element explicitly (avoid clashing with next/image if imported).
    const el = document.createElement("img");
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That doesn't look like an image."));
    el.src = dataUrl;
  });

  let longest = 1000;
  let quality = 0.7;
  let out = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    const scale = Math.min(1, longest / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process that image.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    out = canvas.toDataURL("image/jpeg", quality);
    if (out.length <= maxChars) return out;
    longest = Math.round(longest * 0.8);
    quality = Math.max(0.35, quality - 0.1);
  }
  return out;
}

/** ISO timestamp -> the `datetime-local` value the form inputs expect (local time, no seconds). */
export function toLocalInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

/** Map a quest loaded from the API into the Studio form shape used by the create and edit forms. */
export function questToForm(quest: EditableQuest): QuestForm {
  const vc = quest.verificationConfig ?? {};
  return {
    title: quest.title,
    category: quest.category,
    description: quest.description,
    // Not editable when editing, but kept in the form so the payload stays well-formed.
    rewardAmount: String(Number(quest.rewardAmount)),
    totalSlots: String(quest.totalSlots),
    startAt: "",
    proofType: quest.proofType,
    proofInstructions: quest.proofInstructions,
    sampleEvidence: [quest.sampleEvidence, ...(quest.sampleEvidenceExtras ?? [])].filter(
      (v): v is string => Boolean(v),
    ),
    targetAddress: vc.targetAddress ?? "",
    minAmountNim: vc.minAmountNim != null ? String(vc.minAmountNim) : "",
    requiredHashtags: (vc.requiredHashtags ?? []).join(", "),
    requiredMentions: (vc.requiredMentions ?? []).join(", "),
    expectedMessage: vc.expectedMessage ?? "",
    // The picker always shows one row, so an empty config becomes one blank input.
    livePostUrls: vc.livePostUrls?.length ? vc.livePostUrls : [""],
    requireFirstQuest: Boolean(vc.requireFirstQuest),
    minReputation: vc.minReputation != null ? String(vc.minReputation) : "",
    deadlineAt: toLocalInputValue(vc.deadlineAt),
  };
}

export function isStudioPreview(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

/**
 * Build the quest content from the form: everything that describes the task for workers, plus the
 * proof-type-specific verification rules.
 *
 * Returns the fields in two groups, because creation and editing may not send the same ones:
 * - `content` — safe to send on create AND edit.
 * - `createOnly` — rejected on edit. A published quest locks these (see
 *   `updatePublishedQuestSchema`, which omits them and is strict, so sending one is a 400).
 *
 * Splitting them here — rather than relying on each caller to remember — is what keeps the two
 * flows in step with the API: an edit body is built from `content` alone and physically cannot
 * carry a locked field.
 */
export function buildQuestContentPayload(
  form: QuestForm,
):
  | {
      ok: true;
      content: Record<string, unknown>;
      createOnly: Record<string, unknown>;
      verificationConfig: Record<string, unknown>;
    }
  | { ok: false; error: string } {
  const verificationConfig: Record<string, unknown> = {};
  const proof = form.proofType;

  if (proof === "TRANSACTION_HASH") {
    if (form.targetAddress.trim()) verificationConfig.targetAddress = form.targetAddress.trim();
    if (form.minAmountNim.trim()) {
      const n = Number(form.minAmountNim);
      if (!Number.isFinite(n) || n <= 0) {
        return { ok: false, error: "Min amount: enter a positive NIM amount, or leave blank." };
      }
      verificationConfig.minAmountNim = n;
    }
  }
  if (proof === "LINK") {
    if (form.requiredHashtags.trim()) {
      verificationConfig.requiredHashtags = form.requiredHashtags
        .split(/[,\s]+/)
        .map((h) => h.replace(/^#/, "").trim())
        .filter(Boolean);
    }
    if (form.requiredMentions.trim()) {
      verificationConfig.requiredMentions = form.requiredMentions
        .split(/[,\s]+/)
        .map((h) => h.replace(/^@/, "").trim())
        .filter(Boolean);
    }
  }
  if (proof === "WALLET_INTERACTION" && form.expectedMessage.trim()) {
    verificationConfig.expectedMessage = form.expectedMessage.trim();
  }
  if (proof === "SCREENSHOT" || proof === "UPLOADED_MEDIA") {
    const livePostUrls = form.livePostUrls.map((u) => u.trim()).filter(Boolean);
    for (const url of livePostUrls) {
      try {
        // eslint-disable-next-line no-new
        new URL(url);
      } catch {
        return {
          ok: false,
          error: "Live post URLs: enter a valid http(s) URL for each, or leave blank.",
        };
      }
    }
    if (livePostUrls.length) verificationConfig.livePostUrls = livePostUrls;
  }
  if (proof === "REFERRAL_EVENT" && form.requireFirstQuest) {
    verificationConfig.requireFirstQuest = true;
  }

  if (form.minReputation.trim()) {
    const n = Number(form.minReputation);
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, error: "Min reputation: enter a whole number ≥ 0, or leave blank." };
    }
    verificationConfig.minReputation = n;
  }
  if (form.deadlineAt) {
    const when = new Date(form.deadlineAt);
    if (Number.isNaN(when.getTime())) {
      return { ok: false, error: "Deadline: pick a valid date/time, or leave blank." };
    }
    verificationConfig.deadlineAt = when.toISOString();
  }

  return {
    ok: true,
    content: {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      proofInstructions: form.proofInstructions.trim(),
      ...(form.sampleEvidence.length > 0 ? { sampleEvidence: form.sampleEvidence[0] } : {}),
      ...(form.sampleEvidence.length > 1
        ? { sampleEvidenceExtras: form.sampleEvidence.slice(1) }
        : {}),
    },
    // Locked once a quest is published. Only the create flow may send this.
    createOnly: { proofType: form.proofType },
    // Returned separately so callers can choose: creation omits an empty config (nothing to
    // store), while an edit must send it even when empty so clearing the last rule clears it.
    verificationConfig,
  };
}

export function formatNim(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

const LUNA_PER_NIM = 100_000;

/**
 * Display mirror of the API's tasker-fee split (`splitRewardLuna`): the fee is floored at
 * luna precision so the worker's share is the exact remainder. Display only — the API is
 * authoritative for what actually moves on-chain.
 */
export function splitRewardNim(
  rewardNim: number,
  taskerFeePercent: number,
): { workerNim: number; feeNim: number } {
  if (!Number.isFinite(rewardNim) || rewardNim <= 0) return { workerNim: 0, feeNim: 0 };
  const rewardLuna = Math.round(rewardNim * LUNA_PER_NIM);
  if (!(taskerFeePercent > 0)) return { workerNim: rewardLuna / LUNA_PER_NIM, feeNim: 0 };
  const basisPoints = Math.round(taskerFeePercent * 100); // 7.5% -> 750
  const feeLuna = Math.floor((rewardLuna * basisPoints) / 10_000);
  return { workerNim: (rewardLuna - feeLuna) / LUNA_PER_NIM, feeNim: feeLuna / LUNA_PER_NIM };
}

