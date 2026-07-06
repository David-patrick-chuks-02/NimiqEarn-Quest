"use client";

import Script from "next/script";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const CATEGORIES = [
  { value: "PRODUCT_TESTING", label: "Product testing" },
  { value: "SOCIAL_CAMPAIGN", label: "Social campaign" },
  { value: "COMMUNITY_ENGAGEMENT", label: "Community engagement" },
  { value: "REFERRAL", label: "Referral" },
  { value: "CONTENT", label: "Content" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "BUG_BOUNTY", label: "Bug bounty" },
  { value: "OTHER", label: "Other" },
] as const;

const PROOF_TYPES = [
  { value: "TEXT", label: "Text response" },
  { value: "LINK", label: "Link / URL" },
  { value: "SCREENSHOT", label: "Screenshot" },
  { value: "TRANSACTION_HASH", label: "Transaction hash" },
  { value: "REFERRAL_EVENT", label: "Referral event" },
] as const;

type Phase = "loading" | "no-telegram" | "not-creator" | "ready" | "error";

interface Quest {
  id: string;
  title: string;
  category: string;
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
  deadline: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
}

interface Dashboard {
  user: { displayName: string | null; role: string; status: string };
  quests: { total: number; DRAFT: number; PUBLISHED: number; CLOSED: number };
}

const emptyForm = {
  title: "",
  category: "SOCIAL_CAMPAIGN",
  description: "",
  rewardAmount: "",
  totalSlots: "",
  deadline: "",
  proofType: "LINK",
  proofInstructions: "",
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-[var(--brand-navy-700)] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[var(--brand-gold)] focus:ring-1 focus:ring-[var(--brand-gold)] placeholder:text-[var(--brand-muted)]";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]";

export default function StudioPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const initDataRef = useRef<string>("");

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-telegram-init-data": initDataRef.current,
        ...(init?.headers ?? {}),
      },
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error((body.error as string) ?? `Request failed (${res.status})`);
    }
    return body;
  }, []);

  const loadQuests = useCallback(async () => {
    const body = (await api("/api/studio/quests")) as { quests?: Quest[] };
    setQuests(body.quests ?? []);
  }, [api]);

  const refreshDashboard = useCallback(async () => {
    const me = (await api("/api/studio/me")) as { dashboard?: Dashboard };
    if (me.dashboard) setDashboard(me.dashboard);
  }, [api]);

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
      const me = (await api("/api/studio/me")) as {
        creator?: boolean;
        dashboard?: Dashboard;
      };
      if (!me.creator || !me.dashboard) {
        setPhase("not-creator");
        return;
      }
      setDashboard(me.dashboard);
      await loadQuests();
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [api, loadQuests]);

  // If Telegram injected the SDK before hydration, boot immediately; otherwise the
  // Script onLoad handler below triggers it.
  useEffect(() => {
    if (window.Telegram?.WebApp) void boot();
  }, [boot]);

  const becomeCreator = useCallback(async () => {
    setRegistering(true);
    setError("");
    try {
      const body = (await api("/api/studio/register", { method: "POST" })) as {
        dashboard?: Dashboard;
      };
      if (body.dashboard) setDashboard(body.dashboard);
      await loadQuests();
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRegistering(false);
    }
  }, [api, loadQuests]);

  const submitQuest = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError("");
      setNotice("");
      try {
        await api("/api/studio/quests", {
          method: "POST",
          body: JSON.stringify({
            title: form.title.trim(),
            category: form.category,
            description: form.description.trim(),
            rewardAmount: Number(form.rewardAmount),
            totalSlots: Number(form.totalSlots),
            deadline: form.deadline, // YYYY-MM-DD — coerced to a date server-side
            proofType: form.proofType,
            proofInstructions: form.proofInstructions.trim(),
          }),
        });
        setForm(emptyForm);
        setNotice("Draft saved. Publish it below when you're ready.");
        await Promise.all([loadQuests(), refreshDashboard()]);
      } catch (e2) {
        setError((e2 as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [api, form, loadQuests, refreshDashboard],
  );

  const publish = useCallback(
    async (id: string) => {
      setPublishingId(id);
      setError("");
      setNotice("");
      try {
        await api(`/api/studio/quests/${id}/publish`, { method: "POST" });
        setNotice("Quest published — it's now live.");
        await Promise.all([loadQuests(), refreshDashboard()]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPublishingId(null);
      }
    },
    [api, loadQuests, refreshDashboard],
  );

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={() => void boot()}
      />
      <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6">
        <Header />

        {phase === "loading" && <Info>Loading Creator Studio…</Info>}

        {phase === "no-telegram" && (
          <Info>
            Open <span className="text-white">Creator Studio</span> from the NimiqEarn Quest bot in
            Telegram — tap <span className="text-white">🎨 Open Creator Studio</span> in the Creator
            Hub.
          </Info>
        )}

        {phase === "error" && (
          <Info tone="error">
            {error || "Something went wrong."}
            <button onClick={() => void boot()} className={`${primaryBtn} mt-4`}>
              Try again
            </button>
          </Info>
        )}

        {phase === "not-creator" && (
          <div className="glass mt-4 rounded-2xl p-5 text-center">
            <h2 className="text-lg font-bold text-white">Become a creator</h2>
            <p className="mt-2 text-sm text-[var(--brand-muted)]">
              Publish paid quests and bounties for the Nimiq community. You&apos;ll need a verified
              profile with a linked Nimiq wallet.
            </p>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <button onClick={() => void becomeCreator()} disabled={registering} className={`${primaryBtn} mt-4`}>
              {registering ? "Activating…" : "Become a Creator"}
            </button>
          </div>
        )}

        {phase === "ready" && dashboard && (
          <div className="mt-4 space-y-5">
            <StatRow dashboard={dashboard} />

            {notice && (
              <p className="rounded-xl border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/10 px-3.5 py-2.5 text-sm text-[var(--brand-gold)]">
                {notice}
              </p>
            )}
            {error && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
                {error}
              </p>
            )}

            <form onSubmit={submitQuest} className="glass rounded-2xl p-5">
              <h2 className="text-base font-bold text-white">Create a quest</h2>
              <p className="mt-1 text-xs text-[var(--brand-muted)]">
                Saved as a draft. Review and publish it below.
              </p>

              <div className="mt-4 space-y-3.5">
                <div>
                  <label className={labelClass}>Title</label>
                  <input
                    className={inputClass}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    maxLength={100}
                    placeholder="Follow us on X and repost the pinned"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Category</label>
                    <select
                      className={inputClass}
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Proof type</label>
                    <select
                      className={inputClass}
                      value={form.proofType}
                      onChange={(e) => setForm({ ...form, proofType: e.target.value })}
                    >
                      {PROOF_TYPES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    className={`${inputClass} min-h-[84px] resize-y`}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    maxLength={2000}
                    placeholder="What should the worker do, step by step?"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Reward (NIM)</label>
                    <input
                      className={inputClass}
                      value={form.rewardAmount}
                      onChange={(e) => setForm({ ...form, rewardAmount: e.target.value })}
                      inputMode="decimal"
                      placeholder="10"
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Slots</label>
                    <input
                      className={inputClass}
                      value={form.totalSlots}
                      onChange={(e) => setForm({ ...form, totalSlots: e.target.value })}
                      inputMode="numeric"
                      placeholder="50"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Deadline</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Proof instructions</label>
                  <textarea
                    className={`${inputClass} min-h-[64px] resize-y`}
                    value={form.proofInstructions}
                    onChange={(e) => setForm({ ...form, proofInstructions: e.target.value })}
                    maxLength={1000}
                    placeholder="Paste the link to your repost."
                    required
                  />
                </div>

                <button type="submit" disabled={submitting} className={`${primaryBtn} w-full`}>
                  {submitting ? "Saving…" : "Save draft"}
                </button>
              </div>
            </form>

            <QuestList quests={quests} publishingId={publishingId} onPublish={publish} />
          </div>
        )}
      </main>
    </>
  );
}

const primaryBtn =
  "inline-flex items-center justify-center rounded-full bg-[var(--brand-gold)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-gold-600)] disabled:opacity-60";

function Header() {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/logo.png" alt="NimiqEarn Quest" width={28} height={30} className="rounded-md" />
      <div>
        <p className="text-sm font-bold leading-tight tracking-tight text-white">
          Nimiq<span className="text-[var(--brand-gold)]">Earn</span> Quest
        </p>
        <p className="eyebrow leading-tight">Creator Studio</p>
      </div>
    </div>
  );
}

function Info({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div className="glass mt-4 rounded-2xl p-6 text-center">
      <p className={`text-sm ${tone === "error" ? "text-red-400" : "text-[var(--brand-muted)]"}`}>
        {children}
      </p>
    </div>
  );
}

function StatRow({ dashboard }: { dashboard: Dashboard }) {
  const stats = [
    { label: "Drafts", value: dashboard.quests.DRAFT },
    { label: "Published", value: dashboard.quests.PUBLISHED },
    { label: "Total", value: dashboard.quests.total },
  ];
  return (
    <div>
      <p className="text-sm text-[var(--brand-muted)]">
        Welcome back,{" "}
        <span className="font-semibold text-white">{dashboard.user.displayName ?? "Creator"}</span>
      </p>
      <div className="mt-2.5 grid grid-cols-3 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-[0.7rem] uppercase tracking-wide text-[var(--brand-muted)]">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestList({
  quests,
  publishingId,
  onPublish,
}: {
  quests: Quest[];
  publishingId: string | null;
  onPublish: (id: string) => void;
}) {
  if (quests.length === 0) {
    return (
      <div className="glass rounded-2xl p-5 text-center text-sm text-[var(--brand-muted)]">
        No quests yet. Create your first one above.
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <h2 className="text-base font-bold text-white">Your quests</h2>
      {quests.map((q) => (
        <div key={q.id} className="glass rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{q.title}</p>
              <p className="mt-0.5 text-xs text-[var(--brand-muted)]">
                {Number(q.rewardAmount).toLocaleString()} NIM · {q.filledSlots}/{q.totalSlots} slots
              </p>
            </div>
            <StatusBadge status={q.status} />
          </div>
          {q.status === "DRAFT" && (
            <button
              onClick={() => onPublish(q.id)}
              disabled={publishingId === q.id}
              className={`${primaryBtn} mt-3 w-full`}
            >
              {publishingId === q.id ? "Publishing…" : "Publish"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: Quest["status"] }) {
  const styles: Record<Quest["status"], string> = {
    DRAFT: "bg-white/10 text-[var(--brand-muted)]",
    PUBLISHED: "bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]",
    CLOSED: "bg-white/10 text-[var(--brand-muted)]",
    ARCHIVED: "bg-white/10 text-[var(--brand-muted)]",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {status.toLowerCase()}
    </span>
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
