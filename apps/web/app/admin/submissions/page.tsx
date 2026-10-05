"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminList } from "../_lib/use-list";
import { formatWhen } from "../_lib/utils";
import {
  DetailLink,
  Empty,
  PageHeader,
  Pager,
  SearchBar,
  StatusPill,
} from "../_components/ui";

type Row = {
  id: string;
  questTitle: string;
  questId: string;
  displayName: string | null;
  telegramId: string;
  status: string;
  verificationOutcome: string | null;
  createdAt: string;
  verifiedAt: string | null;
};

export default function AdminSubmissionsPage() {
  const [q, setQ] = useState("");
  const { items, loading, error, page, pageCount, meta, setPage } = useAdminList<Row>(
    "/api/admin/submissions",
    q,
  );

  return (
    <div>
      <PageHeader
        title="Submissions"
        description="All quest submissions with verification outcome and timestamps."
      />
      <SearchBar value={q} onChange={setQ} placeholder="Quest, worker, proof, id…" meta={meta} />
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {items.length === 0 && !loading ? (
        <Empty message="No submissions found." />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[var(--brand-navy-800)] text-[0.65rem] uppercase tracking-[0.08em] text-white/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">Quest</th>
                <th className="px-3 py-2.5 font-medium">Worker</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Outcome</th>
                <th className="px-3 py-2.5 font-medium">Created</th>
                <th className="px-3 py-2.5 font-medium">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {items.map((row) => (
                <tr key={row.id} className="bg-[var(--brand-navy-800)]/30 hover:bg-white/[0.03]">
                  <td className="px-3 py-2.5">
                    <DetailLink href={`/admin/submissions/${row.id}`}>{row.questTitle}</DetailLink>
                    <p className="mt-0.5">
                      <Link
                        href={`/admin/quests/${row.questId}`}
                        className="text-[0.7rem] text-[var(--brand-muted)] hover:text-[var(--brand-gold)]"
                      >
                        quest →
                      </Link>
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--brand-muted)]">
                    <div className="text-white">{row.displayName ?? "—"}</div>
                    <div className="text-xs">{row.telegramId}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill value={row.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    {row.verificationOutcome ? (
                      <StatusPill value={row.verificationOutcome} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                    {formatWhen(row.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                    {formatWhen(row.verifiedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
