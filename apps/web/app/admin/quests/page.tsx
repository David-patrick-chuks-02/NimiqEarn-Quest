"use client";

import { useState } from "react";
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
  title: string;
  category: string;
  status: string;
  proofType: string;
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
  viewCount: number;
  promoted: boolean;
  creatorTelegramId: string;
  creatorDisplayName: string | null;
  createdAt: string;
  publishedAt: string | null;
  fundedAt: string | null;
  startAt: string | null;
};

export default function AdminQuestsPage() {
  const [q, setQ] = useState("");
  const { items, loading, error, page, pageCount, meta, setPage } = useAdminList<Row>(
    "/api/admin/quests",
    q,
  );

  return (
    <div>
      <PageHeader
        title="Quests"
        description="All quests with created, published, and funded timestamps."
      />
      <SearchBar value={q} onChange={setQ} placeholder="Title, creator, id…" meta={meta} />
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {items.length === 0 && !loading ? (
        <Empty message="No quests found." />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-[var(--brand-navy-800)] text-[0.65rem] uppercase tracking-[0.08em] text-white/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">Quest</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Reward</th>
                <th className="px-3 py-2.5 font-medium">Slots</th>
                <th className="px-3 py-2.5 font-medium">Creator</th>
                <th className="px-3 py-2.5 font-medium">Created</th>
                <th className="px-3 py-2.5 font-medium">Published</th>
                <th className="px-3 py-2.5 font-medium">Funded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {items.map((row) => (
                <tr key={row.id} className="bg-[var(--brand-navy-800)]/30 hover:bg-white/[0.03]">
                  <td className="px-3 py-2.5">
                    <DetailLink href={`/admin/quests/${row.id}`}>{row.title}</DetailLink>
                    <p className="mt-0.5 text-xs text-[var(--brand-muted)]">
                      {row.category} · {row.proofType}
                      {row.promoted ? " · promoted" : ""}
                      {" · "}
                      {row.viewCount} views
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill value={row.status} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{row.rewardAmount} NIM</td>
                  <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                    {row.filledSlots}/{row.totalSlots}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--brand-muted)]">
                    <div className="text-white">{row.creatorDisplayName ?? "—"}</div>
                    <div className="text-xs">{row.creatorTelegramId}</div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                    {formatWhen(row.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                    {formatWhen(row.publishedAt)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                    {formatWhen(row.fundedAt)}
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
