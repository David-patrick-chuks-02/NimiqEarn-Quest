"use client";

import Script from "next/script";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "loading" | "no-telegram" | "not-creator" | "ready" | "error";

interface Quest {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
  viewCount: number;
  publishedAt: string | null;
}

interface Analytics {
  id: string;
  title: string;
  status: string;
  rewardAmount: number;
  totalSlots: number;
  filledSlots: number;
  slotsLeft: number;
  viewCount: number;
  pool: number;
  committed: number;
  remainingPool: number;
  conversionRate: number;
  deadline: string;
  daysLeft: number;
  publishedAt: string | null;
  createdAt: string;
  windowDays: number;
  series: { date: string; views: number; fills: number }[];
}

export default function ManagePage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [quests, setQuests] = useState<Quest[]>([]);
  const [selected, setSelected] = useState<Analytics | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const initDataRef = useRef<string>("");

  const api = useCallback(async (path: string) => {
    const res = await fetch(path, {
      headers: { "x-telegram-init-data": initDataRef.current },
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error((body.error as string) ?? `Request failed (${res.status})`);
    return body;
  }, []);

  const loadQuests = useCallback(async () => {
    const body = (await api("/api/studio/quests")) as { quests?: Quest[] };
    // Only published/closed quests have meaningful analytics; drafts have no activity yet.
    setQuests((body.quests ?? []).filter((q) => q.status !== "DRAFT"));
  }, [api]);

  const openQuest = useCallback(
    async (id: string) => {
      setLoadingId(id);
      setError("");
      try {
        const body = (await api(`/api/studio/quests/${id}/analytics`)) as { analytics?: Analytics };
        if (body.analytics) setSelected(body.analytics);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingId(null);
      }
    },
    [api],
  );

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
      const me = (await api("/api/studio/me")) as { creator?: boolean };
      if (!me.creator) {
        setPhase("not-creator");
        return;
      }
      await loadQuests();
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [api, loadQuests]);

  useEffect(() => {
    if (window.Telegram?.WebApp) void boot();
  }, [boot]);

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
          <span className="text-sm font-bold tracking-tight">Manage Quests</span>
        </header>

        {phase === "loading" && <ManageSkeleton />}

        {phase === "no-telegram" && (
          <Info>
            Open <span className="text-white">Manage Quests</span> from the NimiqEarn Quest bot —
            tap <span className="text-white">📊 Manage Quests</span> in the Creator Hub.
          </Info>
        )}

        {phase === "not-creator" && (
          <Info>You need a creator account. Open the Creator Studio first to get set up.</Info>
        )}

        {phase === "error" && (
          <Info tone="error">
            {error || "Something went wrong."}
            <button
              onClick={() => void boot()}
              className="mt-4 rounded-full bg-[var(--brand-gold)] px-5 py-2 text-sm font-semibold text-[var(--brand-ink)]"
            >
              Try again
            </button>
          </Info>
        )}

        {phase === "ready" && !selected && (
          <QuestPicker
            quests={quests}
            loadingId={loadingId}
            error={error}
            onOpen={(id) => void openQuest(id)}
          />
        )}

        {phase === "ready" && selected && (
          <AnalyticsDetail analytics={selected} onBack={() => setSelected(null)} />
        )}
      </main>
    </>
  );
}

function QuestPicker({
  quests,
  loadingId,
  error,
  onOpen,
}: {
  quests: Quest[];
  loadingId: string | null;
  error: string;
  onOpen: (id: string) => void;
}) {
  if (quests.length === 0) {
    return (
      <Info>
        No published quests yet. Publish a quest in the Creator Studio and its analytics will
        appear here.
      </Info>
    );
  }
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-[var(--brand-muted)]">Tap a quest to see its analytics.</p>
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
          {error}
        </p>
      )}
      {quests.map((q) => {
        const fill = q.totalSlots > 0 ? Math.round((q.filledSlots / q.totalSlots) * 100) : 0;
        return (
          <button
            key={q.id}
            onClick={() => onOpen(q.id)}
            disabled={loadingId === q.id}
            className="glass block w-full rounded-xl p-4 text-left transition hover:border-[var(--brand-gold)]/40 disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-semibold text-white">{q.title}</p>
              <span className="shrink-0 text-xs text-[var(--brand-muted)]">
                {loadingId === q.id ? "Loading…" : "View →"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-[var(--brand-muted)]">
              <span>{q.viewCount.toLocaleString()} views</span>
              <span>·</span>
              <span>
                {q.filledSlots}/{q.totalSlots} slots ({fill}%)
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function AnalyticsDetail({ analytics, onBack }: { analytics: Analytics; onBack: () => void }) {
  const conv = `${(analytics.conversionRate * 100).toFixed(1)}%`;
  const fillPct =
    analytics.totalSlots > 0 ? Math.round((analytics.filledSlots / analytics.totalSlots) * 100) : 0;

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="text-sm text-[var(--brand-muted)] transition hover:text-white"
      >
        ← All quests
      </button>

      <div>
        <h1 className="text-lg font-bold text-white">{analytics.title}</h1>
        <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--brand-gold)]">
          {analytics.status.toLowerCase()} ·{" "}
          {analytics.daysLeft > 0 ? `${analytics.daysLeft} days left` : "deadline passed"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="Views" value={analytics.viewCount.toLocaleString()} />
        <Tile label="Conversion" value={conv} />
        <Tile label="Slots filled" value={`${analytics.filledSlots}/${analytics.totalSlots}`} />
        <Tile label="Reward each" value={`${analytics.rewardAmount.toLocaleString()} NIM`} />
      </div>

      <ProgressCard
        label="Slots filled"
        pct={fillPct}
        caption={`${analytics.filledSlots} of ${analytics.totalSlots} · ${analytics.slotsLeft} left`}
      />

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Activity</p>
          <p className="text-xs text-[var(--brand-muted)]">last {analytics.windowDays} days</p>
        </div>
        <TrendChart series={analytics.series} />
        <div className="mt-3 flex items-center gap-4 text-xs">
          <Legend color="var(--brand-gold)" label="Views" />
          <Legend color="#4fd1c5" label="Fills" />
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <p className="text-sm font-semibold text-white">Reward pool</p>
        <dl className="mt-2 space-y-1.5 text-sm">
          <Row label="Total pool" value={`${analytics.pool.toLocaleString()} NIM`} />
          <Row label="Committed (filled)" value={`${analytics.committed.toLocaleString()} NIM`} />
          <Row label="Remaining" value={`${analytics.remainingPool.toLocaleString()} NIM`} />
        </dl>
      </div>
    </div>
  );
}

/**
 * Dual-line time-series (views + fills) rendered as inline SVG — no chart library, so it
 * stays inside the Mini App's strict asset budget. Scales to the max of either series.
 */
function TrendChart({ series }: { series: { date: string; views: number; fills: number }[] }) {
  const W = 300;
  const H = 110;
  const pad = { top: 8, right: 4, bottom: 4, left: 4 };
  const max = Math.max(1, ...series.map((d) => Math.max(d.views, d.fills)));
  const n = series.length;

  const x = (i: number) =>
    n <= 1 ? pad.left : pad.left + (i * (W - pad.left - pad.right)) / (n - 1);
  const y = (v: number) => pad.top + (1 - v / max) * (H - pad.top - pad.bottom);

  const line = (key: "views" | "fills") =>
    series.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");

  const totalViews = series.reduce((s, d) => s + d.views, 0);
  const totalFills = series.reduce((s, d) => s + d.fills, 0);

  if (totalViews === 0 && totalFills === 0) {
    return (
      <div className="mt-3 flex h-[110px] items-center justify-center rounded-xl bg-white/[0.02] text-xs text-[var(--brand-muted)]">
        No activity yet in this window.
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-3 h-auto w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${totalViews} views and ${totalFills} fills over the window`}
    >
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={pad.left}
          x2={W - pad.right}
          y1={pad.top + g * (H - pad.top - pad.bottom)}
          y2={pad.top + g * (H - pad.top - pad.bottom)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}
      <path d={line("views")} fill="none" stroke="var(--brand-gold)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <path d={line("fills")} fill="none" stroke="#4fd1c5" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function ProgressCard({ label, pct, caption }: { label: string; pct: number; caption: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-sm font-bold text-[var(--brand-gold)]">{pct}%</p>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[var(--brand-gold)] transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-[var(--brand-muted)]">{caption}</p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl px-3 py-2.5">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[0.7rem] uppercase tracking-wide text-[var(--brand-muted)]">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--brand-muted)]">{label}</dt>
      <dd className="font-semibold text-white">{value}</dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[var(--brand-muted)]">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
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

function ManageSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass h-[68px] animate-pulse rounded-xl" />
      ))}
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
