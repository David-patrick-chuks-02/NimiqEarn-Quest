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
} from "../_components/ui";

type Row = {
  id: string;
  submissionId: string;
  userId: string | null;
  flagType: string;
  resolution: string;
  detail: unknown;
  createdAt: string;
};

export default function AdminAuditPage() {
  const [q, setQ] = useState("");
  const { items, loading, error, page, pageCount, meta, setPage } = useAdminList<Row>(
    "/api/admin/moderation",
    q,
  );

  return (
    <div>
      <PageHeader
        title="Audit"
        description="Moderation events — flags, resolutions, and related submissions."
      />
      <SearchBar value={q} onChange={setQ} placeholder="Flag, resolution, submission id…" meta={meta} />
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {items.length === 0 && !loading ? (
        <Empty message="No audit events." />
      ) : (
        <div className="mt-4 space-y-2">
          {items.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">
                  {row.flagType} → {row.resolution}
                </p>
                <p className="text-xs tabular-nums text-[var(--brand-muted)]">
                  {formatWhen(row.createdAt)}
                </p>
              </div>
              <p className="mt-1 text-xs text-[var(--brand-muted)]">
                Submission{" "}
                <DetailLink href={`/admin/submissions/${row.submissionId}`}>
                  {row.submissionId.slice(0, 8)}…
                </DetailLink>
                {row.userId ? (
                  <>
                    {" · "}
                    Account{" "}
                    <DetailLink href={`/admin/accounts/${row.userId}`}>
                      {row.userId.slice(0, 8)}…
                    </DetailLink>
                  </>
                ) : null}
              </p>
              {row.detail != null && (
                <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-black/25 p-2 font-mono text-[0.65rem] text-[var(--brand-muted)]">
                  {typeof row.detail === "string" ? row.detail : JSON.stringify(row.detail, null, 2)}
                </pre>
              )}
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
