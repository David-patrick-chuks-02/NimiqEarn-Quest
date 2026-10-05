"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "./_lib/auth";
import { formatWhen } from "./_lib/utils";
import { DetailLink, Empty, Field, PageHeader, StatusPill, ghostBtn } from "./_components/ui";

type Overview = {
  counts: {
    queue: number;
    submissions: number;
    quests: number;
    accounts: number;
    audit: number;
    feedback: number;
  };
  queue: Array<{
    id: string;
    questTitle: string;
    displayName: string | null;
    telegramId: string;
    createdAt: string;
    verificationOutcome: string | null;
  }>;
};

export default function AdminOverviewPage() {
  const { adminFetch, unlocked } = useAdminAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    (async () => {
      try {
        const next = (await adminFetch("/api/admin/overview")) as Overview;
        if (!cancelled) setData(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load overview");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, adminFetch]);

  const counts = data?.counts;
  const recentQueue = data?.queue ?? [];

  const cards = [
    { href: "/admin/queue", label: "Review queue", value: counts?.queue },
    { href: "/admin/submissions", label: "Submissions", value: counts?.submissions },
    { href: "/admin/quests", label: "Quests", value: counts?.quests },
    { href: "/admin/accounts", label: "Accounts", value: counts?.accounts },
    { href: "/admin/audit", label: "Audit events", value: counts?.audit },
    { href: "/admin/feedback", label: "Feedback", value: counts?.feedback },
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Platform ops console — review queue, quests, accounts, and audit trails."
        actions={
          <Link href="/admin/queue" className={ghostBtn} prefetch>
            Open queue
          </Link>
        }
      />

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            prefetch
            className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/60 px-4 py-4 transition hover:border-[var(--brand-gold)]/30"
          >
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white/35">{c.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">
              {c.value === undefined ? "—" : c.value}
            </p>
          </Link>
        ))}
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Needs review</h2>
          <Link href="/admin/queue" prefetch className="text-sm text-[var(--brand-gold)] hover:underline">
            View all
          </Link>
        </div>
        {!data && !error ? (
          <p className="mt-4 text-sm text-[var(--brand-muted)]">Loading…</p>
        ) : recentQueue.length === 0 ? (
          <Empty message="Queue is clear." />
        ) : (
          <div className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/10">
            {recentQueue.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 bg-[var(--brand-navy-800)]/40 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <DetailLink href={`/admin/submissions/${row.id}`}>{row.questTitle}</DetailLink>
                  <p className="mt-0.5 text-xs text-[var(--brand-muted)]">
                    {row.displayName ?? "—"} · {row.telegramId} · {formatWhen(row.createdAt)}
                  </p>
                </div>
                {row.verificationOutcome && <StatusPill value={row.verificationOutcome} />}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 p-4">
          <h3 className="text-sm font-semibold text-white">Quick links</h3>
          <ul className="mt-3 space-y-2 text-sm text-[var(--brand-muted)]">
            <li>
              <Link href="/admin/quests" prefetch className="hover:text-[var(--brand-gold)]">
                Browse quests with created / funded times
              </Link>
            </li>
            <li>
              <Link href="/admin/accounts" prefetch className="hover:text-[var(--brand-gold)]">
                Inspect accounts, wallets, reputation
              </Link>
            </li>
            <li>
              <Link href="/admin/audit" prefetch className="hover:text-[var(--brand-gold)]">
                Moderation audit log
              </Link>
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 p-4">
          <h3 className="text-sm font-semibold text-white">Local only</h3>
          <div className="mt-3 grid gap-3">
            <Field label="Scope">Development ops console — not deployed to Railway.</Field>
            <Field label="Auth">Email + password (ADMIN_EMAIL / ADMIN_PASSWORD)</Field>
          </div>
        </div>
      </section>
    </div>
  );
}
