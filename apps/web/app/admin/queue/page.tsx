"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminList } from "../_lib/use-list";
import { formatWhen } from "../_lib/utils";
import {
  Empty,
  PageHeader,
  Pager,
  SearchBar,
  StatusPill,
  acceptBtn,
  dangerBtn,
  ghostBtn,
} from "../_components/ui";

type Row = {
  id: string;
  questTitle: string;
  questId: string;
  displayName: string | null;
  telegramId: string;
  reputationScore: number;
  verificationOutcome: string | null;
  confidenceScore: number | null;
  proofPreview?: string;
  decisionReasons?: string[];
  createdAt: string;
};

export default function AdminQueuePage() {
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { items, loading, error, page, pageCount, meta, setPage, reload, setError, adminFetch } =
    useAdminList<Row>("/api/admin/submissions", q, { queue: "PLATFORM" });

  async function act(id: string, action: "accept" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      await adminFetch(`/api/admin/submissions/${id}/${action}`, { method: "POST", body: "{}" });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Review queue"
        description="PLATFORM / MANUAL_REVIEW submissions waiting for an accept or reject decision."
        actions={
          <button type="button" className={ghostBtn} onClick={reload} disabled={loading}>
            Refresh
          </button>
        }
      />
      <SearchBar value={q} onChange={setQ} placeholder="Quest, worker, telegram id…" meta={meta} />
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {items.length === 0 && !loading ? (
        <Empty message="Nothing in the queue." />
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/submissions/${row.id}`}
                    className="text-base font-semibold text-white hover:text-[var(--brand-gold)]"
                  >
                    {row.questTitle}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--brand-muted)]">
                    {row.displayName ?? "—"} · tg {row.telegramId} · rep {row.reputationScore} ·{" "}
                    {formatWhen(row.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {row.verificationOutcome && <StatusPill value={row.verificationOutcome} />}
                  {row.confidenceScore != null && (
                    <span className="text-xs tabular-nums text-[var(--brand-muted)]">
                      conf {(row.confidenceScore * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              {row.proofPreview && (
                <p className="mt-3 max-h-20 overflow-hidden whitespace-pre-wrap break-all rounded-lg bg-black/25 p-2 font-mono text-[0.7rem] text-[var(--brand-muted)]">
                  {row.proofPreview}
                </p>
              )}
              {row.decisionReasons && row.decisionReasons.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-[var(--brand-muted)]">
                  {row.decisionReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={acceptBtn}
                  disabled={busyId === row.id}
                  onClick={() => void act(row.id, "accept")}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className={dangerBtn}
                  disabled={busyId === row.id}
                  onClick={() => void act(row.id, "reject")}
                >
                  Reject
                </button>
                <Link href={`/admin/quests/${row.questId}`} className={ghostBtn}>
                  Quest
                </Link>
                <Link href={`/admin/submissions/${row.id}`} className={ghostBtn}>
                  Details
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pager
        page={page}
        pageCount={pageCount}
        loading={loading}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}
