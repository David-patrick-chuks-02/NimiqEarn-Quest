"use client";

import Image from "next/image";
import type { Dashboard } from "./types";

export function Header({ onRefresh, refreshing }: { onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/logo.png" alt="NimiqEarn Quest" width={28} height={30} className="rounded-md" />
      <div>
        <p className="text-sm font-bold leading-tight tracking-tight text-white">
          Nimiq<span className="text-[var(--brand-gold)]">Earn</span> Quest
        </p>
        <p className="eyebrow leading-tight">Creator Studio</p>
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[var(--brand-muted)] transition hover:bg-white/5 disabled:opacity-50"
        >
          <IconRefresh className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>
  );
}

function IconRefresh({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

/** Loading placeholder that mirrors the ready layout (stat row + form) to avoid a content jump. */
export function StudioSkeleton() {
  return (
    <div className="mt-4 space-y-5" aria-busy="true" aria-label="Loading Creator Studio">
      <div>
        <Shimmer className="h-4 w-40" />
        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-xl px-3 py-2.5">
              <Shimmer className="mx-auto h-6 w-8" />
              <Shimmer className="mx-auto mt-2 h-2.5 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
        <Shimmer className="h-5 w-32" />
        <Shimmer className="mt-2 h-3 w-48" />
        <div className="mt-4 space-y-3.5">
          <Shimmer className="h-11 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Shimmer className="h-11 w-full" />
            <Shimmer className="h-11 w-full" />
          </div>
          <Shimmer className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Shimmer className="h-11 w-full" />
            <Shimmer className="h-11 w-full" />
          </div>
          <Shimmer className="h-11 w-full" />
          <Shimmer className="mt-1 h-11 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/6 ${className}`} />;
}

export function Spinner() {
  return (
    <span
      className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-[var(--brand-gold)]"
      aria-hidden
    />
  );
}

/** Full-screen blocking overlay shown while a studio write (save / publish / register) runs. */
export function LoadingOverlay({ label }: { label: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="glass flex items-center gap-3 rounded-2xl px-5 py-4">
        <Spinner />
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
    </div>
  );
}


export function Info({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div className="glass mt-4 rounded-2xl p-6 text-center">
      <p className={`text-sm ${tone === "error" ? "text-red-400" : "text-[var(--brand-muted)]"}`}>
        {children}
      </p>
    </div>
  );
}

export function StatRow({ dashboard }: { dashboard: Dashboard }) {
  const stats = [
    { label: "Drafts", value: dashboard.quests.DRAFT },
    { label: "Published", value: dashboard.quests.PUBLISHED },
    { label: "Total", value: dashboard.quests.total },
  ];
  return (
    <div>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-1 text-2xl font-bold text-white">
        {dashboard.user.displayName ?? "Creator"}
      </h1>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl px-3 py-3 text-center">
            <p className="text-2xl font-bold tracking-tight text-white">{s.value}</p>
            <p className="mt-0.5 text-[0.68rem] uppercase tracking-wide text-[var(--brand-muted)]">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

