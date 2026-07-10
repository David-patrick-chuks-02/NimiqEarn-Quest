"use client";

import Script from "next/script";
import Image from "next/image";
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
  deadline: string;
  proofType: string;
  proofInstructions: string;
  creatorName: string | null;
}

interface WorkerView {
  quest: PublicQuest;
  isCreator: boolean;
  submitted: boolean;
  canSubmit: boolean;
  reason: "NOT_REGISTERED" | "CREATOR" | "ALREADY_SUBMITTED" | "FULL" | "EXPIRED" | null;
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

const PROOF_META: Record<string, { label: string; placeholder: string; multiline: boolean }> = {
  TEXT: { label: "Your response", placeholder: "Write your response here…", multiline: true },
  LINK: { label: "Your link", placeholder: "https://…", multiline: false },
  SCREENSHOT: { label: "Screenshot link", placeholder: "Paste a link to your screenshot", multiline: false },
  TRANSACTION_HASH: { label: "Transaction hash", placeholder: "e.g. a1b2c3…", multiline: false },
  REFERRAL_EVENT: { label: "Referral details", placeholder: "Who did you refer?", multiline: true },
};

const BLOCKED_COPY: Record<NonNullable<WorkerView["reason"]>, string> = {
  NOT_REGISTERED: "Send /start to the bot first to create your worker profile, then reopen this quest.",
  CREATOR: "You created this quest — you can't complete your own quest.",
  ALREADY_SUBMITTED: "You've already done this quest. ✓",
  FULL: "All slots for this quest are taken.",
  EXPIRED: "This quest's deadline has passed.",
};

export default function DoQuestPage() {
  const params = useParams<{ id: string }>();
  const questId = params?.id;

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [view, setView] = useState<WorkerView | null>(null);
  const [proof, setProof] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const initDataRef = useRef<string>("");

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const headers: Record<string, string> = {
      "x-telegram-init-data": initDataRef.current,
      ...((init?.headers as Record<string, string>) ?? {}),
    };
    if (init?.body != null) headers["Content-Type"] = "application/json";
    const res = await fetch(path, { ...init, headers });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error((body.error as string) ?? `Request failed (${res.status})`);
    return body;
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
    if (proof.trim().length === 0) {
      setError("Please enter your proof before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api(`/api/quests/${questId}/submit`, {
        method: "POST",
        body: JSON.stringify({ proof: proof.trim() }),
      });
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      // Refresh context so the UI reflects a now-full/closed quest.
      await load().catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  }, [api, load, proof, questId]);

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
            <p className="text-4xl">🎉</p>
            <h1 className="mt-3 text-lg font-bold text-white">Submitted!</h1>
            <p className="mt-2 text-sm text-[var(--brand-muted)]">
              Your proof for <span className="text-white">{view.quest.title}</span> was accepted.
              Your {Number(view.quest.rewardAmount).toLocaleString()} NIM reward is on its way to
              your wallet.
            </p>
          </div>
        )}

        {(phase === "ready" || (phase === "error" && view)) && view && (
          <div className="space-y-5">
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
                <Stat label="Deadline" value={view.quest.deadline.slice(0, 10)} />
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
            </div>

            {view.canSubmit ? (
              <div className="glass rounded-2xl p-5">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                  {proofMeta.label}
                </label>
                {proofMeta.multiline ? (
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
                  disabled={submitting}
                  className={`${primaryBtn} mt-3 w-full`}
                >
                  {submitting ? "Submitting…" : "Submit & earn"}
                </button>
              </div>
            ) : (
              <div
                className={`glass rounded-2xl p-5 text-center text-sm ${
                  view.submitted ? "text-[var(--brand-gold)]" : "text-[var(--brand-muted)]"
                }`}
              >
                {view.reason ? BLOCKED_COPY[view.reason] : "This quest can't be completed right now."}
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
