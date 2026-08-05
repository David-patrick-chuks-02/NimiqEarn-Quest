"use client";

import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "loading" | "no-telegram" | "ready" | "error" | "done";

interface PublicQuest {
  id: string;
  title: string;
  description: string;
  category: string;
  rewardAmount: string;
  totalSlots: number;
  slotsLeft: number;
  startAt: string | null;
  scheduled: boolean;
  promoted: boolean;
  proofType: string;
  proofInstructions: string;
  sampleEvidence: string | null;
  creatorName: string | null;
}

interface WorkerView {
  quest: PublicQuest;
  isCreator: boolean;
  submitted: boolean;
  submissionStatus?: string | null;
  canSubmit: boolean;
  reason:
    | "NOT_REGISTERED"
    | "CREATOR"
    | "ALREADY_SUBMITTED"
    | "FULL"
    | "NOT_STARTED"
    | "SUSPENDED"
    | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  PRODUCT_TESTING: "Product testing",
  SOCIAL_CAMPAIGN: "Social campaign",
  COMMUNITY_ENGAGEMENT: "Community engagement",
  REFERRAL: "Referral",
  CONTENT: "Content",
  FEEDBACK: "Feedback",
  BUG_BOUNTY: "Bug bounty",
  OTHER: "Quest",
};

const PROOF_META: Record<string, { label: string; placeholder: string; multiline: boolean; upload?: boolean; accept?: string }> = {
  TEXT: { label: "Your response", placeholder: "Write your response here…", multiline: true },
  LINK: { label: "Your link", placeholder: "https://…", multiline: false },
  SCREENSHOT: {
    label: "Upload screenshot",
    placeholder: "",
    multiline: false,
    upload: true,
    accept: "image/jpeg,image/png,image/webp",
  },
  UPLOADED_MEDIA: {
    label: "Upload image or video",
    placeholder: "",
    multiline: false,
    upload: true,
    accept: "image/jpeg,image/png,image/webp,video/mp4,video/webm",
  },
  TRANSACTION_HASH: { label: "Transaction hash", placeholder: "e.g. a1b2c3…", multiline: false },
  WALLET_INTERACTION: {
    label: "Signed message JSON",
    placeholder: '{"message":"…","publicKey":"…","signature":"…","address":"NQ…"}',
    multiline: true,
  },
  REFERRAL_EVENT: { label: "Referral details", placeholder: "Who did you refer?", multiline: true },
};

function deviceFingerprint(): string {
  try {
    const raw = [
      navigator.userAgent,
      navigator.language,
      String(screen.width),
      String(screen.height),
      String(screen.colorDepth),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join("|");
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
    return `fp_${(h >>> 0).toString(16)}`;
  } catch {
    return "fp_unknown";
  }
}

/** Compress an uploaded image to a JPEG data URL (max ~1000px) for inline storage. */
async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = document.createElement("img");
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That doesn't look like an image."));
    el.src = dataUrl;
  });
  const max = 1000;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

const BLOCKED_COPY: Record<NonNullable<WorkerView["reason"]>, string> = {
  NOT_REGISTERED: "Send /start to the bot first to create your worker profile, then reopen this quest.",
  CREATOR: "You created this quest — you can't complete your own quest.",
  ALREADY_SUBMITTED: "You've already submitted proof for this quest. Wait for the creator to review it.",
  FULL: "All slots for this quest are taken.",
  NOT_STARTED: "This quest hasn't started yet. Check back at its start time.",
  SUSPENDED: "Your account is suspended and can't submit quests.",
};

export default function DoQuestPage() {
  const params = useParams<{ id: string }>();
  const questId = params?.id;

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [view, setView] = useState<WorkerView | null>(null);
  const [proof, setProof] = useState("");
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [doneStatus, setDoneStatus] = useState<"PENDING" | "ACCEPTED" | "REJECTED" | null>(null);
  const [doneOutcome, setDoneOutcome] = useState<string | null>(null);
  const initDataRef = useRef<string>("");

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const headers: Record<string, string> = {
      "x-telegram-init-data": initDataRef.current,
      ...((init?.headers as Record<string, string>) ?? {}),
    };
    if (init?.body != null) headers["Content-Type"] = "application/json";

    // The API runs on a plan that can cold-start; the first request through the proxy may
    // return a gateway error (502/503/504) while it wakes. Retry a few times with backoff
    // before surfacing it, but only for idempotent GETs so we never double-submit.
    const idempotent = !init?.method || init.method.toUpperCase() === "GET";
    const maxAttempts = idempotent ? 4 : 1;
    let lastGatewayStatus = 0;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let res: Response;
      try {
        res = await fetch(path, { ...init, headers });
      } catch (e) {
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        throw e;
      }
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxAttempts - 1) {
        lastGatewayStatus = res.status;
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error((body.error as string) ?? `Request failed (${res.status})`);
      return body;
    }
    throw new Error(`The server is waking up (${lastGatewayStatus}). Please try again in a moment.`);
  }, []);

  const load = useCallback(async () => {
    const body = (await api(`/api/quests/${questId}/worker`)) as unknown as WorkerView;
    setView(body);
  }, [api, questId]);

  const boot = useCallback(async () => {
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData ?? "";
    if (!initData) {
      setPhase("no-telegram");
      return;
    }
    initDataRef.current = initData;
    try {
      tg?.ready();
      tg?.expand();
      tg?.setHeaderColor?.("#070c17");
      tg?.setBackgroundColor?.("#070c17");
    } catch {
      // Older Telegram clients may not support every method — non-fatal.
    }
    try {
      await load();
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [load]);

  useEffect(() => {
    if (window.Telegram?.WebApp) void boot();
  }, [boot]);

  const submit = useCallback(async () => {
    const isUpload =
      view?.quest.proofType === "SCREENSHOT" || view?.quest.proofType === "UPLOADED_MEDIA";
    const payload = isUpload ? proofImage : proof.trim();
    if (!payload) {
      setError(isUpload ? "Upload proof before submitting." : "Please enter your proof before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = (await api(`/api/quests/${questId}/submit`, {
        method: "POST",
        headers: { "x-device-fingerprint": deviceFingerprint() },
        body: JSON.stringify({ proof: payload }),
      })) as { txUrl?: string | null; status?: string; outcome?: string | null };
      setTxUrl(res.txUrl ?? null);
      setDoneStatus(
        res.status === "ACCEPTED" || res.status === "REJECTED" || res.status === "PENDING"
          ? res.status
          : "PENDING",
      );
      setDoneOutcome(res.outcome ?? null);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      await load().catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  }, [api, load, proof, proofImage, questId, view?.quest.proofType]);

  const onProofImage = useCallback(async (file: File | null) => {
    if (!file) return;
    setProofBusy(true);
    setError("");
    try {
      if (file.type.startsWith("video/")) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Couldn't read that file."));
          reader.readAsDataURL(file);
        });
        if (dataUrl.length > 2_500_000) {
          setError("That video is too large. Try a shorter clip or a screenshot.");
          return;
        }
        setProofImage(dataUrl);
        return;
      }
      const compressed = await compressImage(file);
      if (compressed.length > 700_000) {
        setError("That image is too large even after compression. Try a smaller screenshot.");
        return;
      }
      setProofImage(compressed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProofBusy(false);
    }
  }, []);

  const proofMeta = view ? (PROOF_META[view.quest.proofType] ?? PROOF_META.TEXT) : PROOF_META.TEXT;

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={() => void boot()}
      />
      <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6">
        <header className="mb-5 flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={26} height={28} className="rounded-md" />
          <span className="text-sm font-bold tracking-tight">
            Nimiq<span className="text-[var(--brand-gold)]">Earn</span> Quest
          </span>
        </header>

        {phase === "loading" && <QuestSkeleton />}

        {phase === "no-telegram" && (
          <Info>Open this quest from the NimiqEarn Quest bot in Telegram to complete it.</Info>
        )}

        {phase === "error" && !view && (
          <Info tone="error">
            {error || "Something went wrong."}
            <button onClick={() => void boot()} className={`${primaryBtn} mt-4`}>
              Try again
            </button>
          </Info>
        )}

        {phase === "done" && view && (
          <div className="glass rounded-2xl p-6 text-center">
            <h1 className="text-lg font-bold text-white">
              {doneStatus === "ACCEPTED"
                ? "Verified & paid!"
                : doneStatus === "REJECTED"
                  ? "Not accepted"
                  : "Submitted!"}
            </h1>
            <p className="mt-2 text-sm text-[var(--brand-muted)]">
              {doneStatus === "ACCEPTED" ? (
                <>
                  Your proof for <span className="text-white">{view.quest.title}</span> was
                  auto-approved.{" "}
                  {Number(view.quest.rewardAmount).toLocaleString()} NIM is on its way to your
                  wallet.
                </>
              ) : doneStatus === "REJECTED" ? (
                <>
                  Verification rejected your proof for{" "}
                  <span className="text-white">{view.quest.title}</span>. Try another quest or
                  follow the instructions more closely.
                </>
              ) : (
                <>
                  Your proof for <span className="text-white">{view.quest.title}</span> is pending
                  review
                  {doneOutcome === "MANUAL_REVIEW" ? " (flagged for manual check)" : ""}.
                  You&apos;ll receive {Number(view.quest.rewardAmount).toLocaleString()} NIM if
                  it&apos;s accepted.
                </>
              )}
            </p>
            {txUrl && (
              <a
                href={txUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-[var(--brand-gold)] underline"
              >
                View the payout on-chain
              </a>
            )}
            <Link href="/earn" className={`${primaryBtn} mt-5 block w-full`}>
              Browse more quests
            </Link>
          </div>
        )}

        {(phase === "ready" || (phase === "error" && view)) && view && (
          <div className="space-y-5">
            <Link
              href="/earn"
              className="inline-block text-sm text-[var(--brand-muted)] transition hover:text-white"
            >
              ← Browse quests
            </Link>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-[var(--brand-gold)]">
                {CATEGORY_LABELS[view.quest.category] ?? "Quest"}
              </p>
              <h1 className="mt-1 text-xl font-bold text-white">{view.quest.title}</h1>
              {view.quest.creatorName && (
                <p className="mt-0.5 text-sm text-[var(--brand-muted)]">
                  by <span className="text-white">{view.quest.creatorName}</span>
                </p>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <Stat label="Reward" value={`${Number(view.quest.rewardAmount).toLocaleString()}`} highlight />
                <Stat label="Slots left" value={`${view.quest.slotsLeft}/${view.quest.totalSlots}`} />
                <Stat
                  label={view.quest.scheduled ? "Starts" : "Status"}
                  value={
                    view.quest.scheduled && view.quest.startAt
                      ? view.quest.startAt.slice(0, 10)
                      : "Open"
                  }
                />
              </div>

              <p className="mt-4 whitespace-pre-line text-sm text-[var(--brand-text)]">
                {view.quest.description}
              </p>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                  What to submit
                </p>
                <p className="mt-1 text-sm text-white">{view.quest.proofInstructions}</p>
              </div>

              {view.quest.sampleEvidence && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                    Example of accepted proof
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={view.quest.sampleEvidence}
                    alt="Sample evidence"
                    className="mt-2 w-full rounded-xl border border-white/10"
                  />
                </div>
              )}
            </div>

            {view.canSubmit ? (
              <div className="glass rounded-2xl p-5">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                  {proofMeta.label}
                </label>
                {proofMeta.upload ? (
                  <div className="mt-2">
                    {proofImage ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={proofImage}
                          alt="Your screenshot"
                          className="w-full rounded-xl border border-white/10"
                        />
                        <button
                          type="button"
                          onClick={() => setProofImage(null)}
                          className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-black/20 px-4 py-8 transition hover:border-[var(--brand-gold)]/50 hover:bg-black/30">
                        <input
                          type="file"
                          accept={proofMeta.accept ?? "image/*"}
                          className="hidden"
                          disabled={proofBusy || submitting}
                          onChange={(e) => void onProofImage(e.target.files?.[0] ?? null)}
                        />
                        <span className="text-sm font-semibold text-white">
                          {proofBusy ? "Processing…" : "Tap to upload proof"}
                        </span>
                        <span className="mt-1 text-xs text-[var(--brand-muted)]">
                          {proofMeta.accept?.includes("video")
                            ? "Image or short video from your gallery"
                            : "PNG or JPG from your gallery"}
                        </span>
                      </label>
                    )}
                  </div>
                ) : proofMeta.multiline ? (
                  <textarea
                    className={`${inputClass} min-h-[100px]`}
                    value={proof}
                    onChange={(e) => setProof(e.target.value)}
                    placeholder={proofMeta.placeholder}
                    maxLength={2000}
                  />
                ) : (
                  <input
                    className={inputClass}
                    value={proof}
                    onChange={(e) => setProof(e.target.value)}
                    placeholder={proofMeta.placeholder}
                    maxLength={2000}
                  />
                )}
                {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                <button
                  onClick={() => void submit()}
                  disabled={submitting || proofBusy || (proofMeta.upload ? !proofImage : !proof.trim())}
                  className={`${primaryBtn} mt-3 w-full`}
                >
                  {submitting ? "Submitting…" : "Submit for review"}
                </button>
              </div>
            ) : (
              <div className="glass rounded-2xl p-5 text-center">
                <p
                  className={`text-sm ${
                    view.submitted ? "text-[var(--brand-gold)]" : "text-[var(--brand-muted)]"
                  }`}
                >
                  {view.reason ? BLOCKED_COPY[view.reason] : "This quest can't be completed right now."}
                </p>
                <Link href="/earn" className={`${primaryBtn} mt-4 block w-full`}>
                  Browse other quests
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

const inputClass =
  "mt-1.5 block w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-[var(--brand-navy-700)] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[var(--brand-gold)] focus:ring-1 focus:ring-[var(--brand-gold)] placeholder:text-[var(--brand-muted)]";
const primaryBtn =
  "rounded-full bg-[var(--brand-gold)] px-6 py-3 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-gold-600)] disabled:opacity-60";

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-center">
      <p className={`text-sm font-bold ${highlight ? "text-[var(--brand-gold)]" : "text-white"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[0.62rem] uppercase tracking-wide text-[var(--brand-muted)]">{label}</p>
    </div>
  );
}

function Info({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div
      className={`glass mt-4 rounded-2xl p-5 text-center text-sm ${
        tone === "error" ? "text-red-400" : "text-[var(--brand-muted)]"
      }`}
    >
      {children}
    </div>
  );
}

function QuestSkeleton() {
  return (
    <div className="space-y-4">
      <div className="glass h-52 animate-pulse rounded-2xl" />
      <div className="glass h-40 animate-pulse rounded-2xl" />
    </div>
  );
}

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: string;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
