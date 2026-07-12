"use client";

// Per-quest analytics UI, shared by the Creator Studio quest list. Fetched from
// GET /api/studio/quests/:id/analytics and rendered inline so creators create AND review
// quests in one Mini App (no app switching).

export interface Analytics {
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

export function AnalyticsDetail({
  analytics,
  onBack,
  backLabel = "← Back to quests",
}: {
  analytics: Analytics;
  onBack: () => void;
  backLabel?: string;
}) {
  const conv = `${(analytics.conversionRate * 100).toFixed(1)}%`;
  const fillPct =
    analytics.totalSlots > 0 ? Math.round((analytics.filledSlots / analytics.totalSlots) * 100) : 0;

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="text-sm text-[var(--brand-muted)] transition hover:text-white"
      >
        {backLabel}
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

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/10 ${className}`} />;
}

// Shown the instant a quest is tapped — real title + back button, placeholder charts —
// so opening analytics feels instant while the data loads.
export function AnalyticsSkeleton({
  title,
  onBack,
  backLabel = "← Back to quests",
}: {
  title: string;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="text-sm text-[var(--brand-muted)] transition hover:text-white"
      >
        {backLabel}
      </button>

      <div>
        <h1 className="text-lg font-bold text-white">{title}</h1>
        <Shimmer className="mt-1.5 h-3 w-28" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-xl px-3 py-2.5">
            <Shimmer className="h-5 w-16" />
            <Shimmer className="mt-2 h-2.5 w-12" />
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-4">
        <Shimmer className="h-4 w-24" />
        <Shimmer className="mt-3 h-2.5 w-full rounded-full" />
        <Shimmer className="mt-2 h-3 w-40" />
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <Shimmer className="h-4 w-16" />
          <Shimmer className="h-3 w-20" />
        </div>
        <Shimmer className="mt-3 h-[110px] w-full rounded-xl" />
      </div>
    </div>
  );
}
