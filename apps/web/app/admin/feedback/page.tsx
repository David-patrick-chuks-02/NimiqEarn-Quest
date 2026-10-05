"use client";

import { useState } from "react";
import { useAdminList } from "../_lib/use-list";
import { formatWhen } from "../_lib/utils";
import { Empty, PageHeader, Pager, SearchBar } from "../_components/ui";

type Row = {
  id: string;
  displayName: string | null;
  telegramHandle: string | null;
  message: string;
  rating: number | null;
  createdAt: string;
};

export default function AdminFeedbackPage() {
  const [q, setQ] = useState("");
  const { items, loading, error, page, pageCount, meta, setPage } = useAdminList<Row>(
    "/api/admin/feedback",
    q,
  );

  return (
    <div>
      <PageHeader title="Feedback" description="User-submitted feedback and ratings." />
      <SearchBar value={q} onChange={setQ} placeholder="Name, handle, message…" meta={meta} />
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {items.length === 0 && !loading ? (
        <Empty message="No feedback yet." />
      ) : (
        <div className="mt-4 space-y-2">
          {items.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">
                  {row.displayName ?? "Anonymous"}
                  {row.telegramHandle ? (
                    <span className="ml-2 text-[var(--brand-muted)]">@{row.telegramHandle}</span>
                  ) : null}
                  {row.rating != null ? (
                    <span className="ml-2 text-[var(--brand-gold)]">{row.rating}/5</span>
                  ) : null}
                </p>
                <p className="text-xs tabular-nums text-[var(--brand-muted)]">
                  {formatWhen(row.createdAt)}
                </p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--brand-muted)]">{row.message}</p>
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
