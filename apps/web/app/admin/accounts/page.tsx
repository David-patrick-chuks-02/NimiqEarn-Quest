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
  dangerBtn,
  ghostBtn,
} from "../_components/ui";

type Row = {
  id: string;
  telegramId: string;
  telegramUsername?: string | null;
  displayName: string | null;
  role?: string;
  status: string;
  reputationScore: number;
  walletCount?: number;
  primaryWalletStatus?: string | null;
  createdAt?: string;
};

export default function AdminAccountsPage() {
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { items, loading, error, page, pageCount, meta, setPage, reload, setError, adminFetch } =
    useAdminList<Row>("/api/admin/users", q);

  async function setStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    setBusyId(id);
    setError(null);
    try {
      await adminFetch(`/api/admin/users/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Users, roles, reputation, wallets, and account status."
      />
      <SearchBar value={q} onChange={setQ} placeholder="Name, telegram id, @handle…" meta={meta} />
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {items.length === 0 && !loading ? (
        <Empty message="No accounts found." />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-[var(--brand-navy-800)] text-[0.65rem] uppercase tracking-[0.08em] text-white/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">Account</th>
                <th className="px-3 py-2.5 font-medium">Role</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Rep</th>
                <th className="px-3 py-2.5 font-medium">Wallets</th>
                <th className="px-3 py-2.5 font-medium">Created</th>
                <th className="px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {items.map((row) => (
                <tr key={row.id} className="bg-[var(--brand-navy-800)]/30 hover:bg-white/[0.03]">
                  <td className="px-3 py-2.5">
                    <DetailLink href={`/admin/accounts/${row.id}`}>
                      {row.displayName ?? row.telegramId}
                    </DetailLink>
                    <p className="mt-0.5 text-xs text-[var(--brand-muted)]">
                      {row.telegramId}
                      {row.telegramUsername ? ` · @${row.telegramUsername}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--brand-muted)]">{row.role ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <StatusPill value={row.status} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{row.reputationScore}</td>
                  <td className="px-3 py-2.5 text-[var(--brand-muted)]">
                    {row.walletCount ?? 0}
                    {row.primaryWalletStatus ? ` · ${row.primaryWalletStatus}` : ""}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                    {formatWhen(row.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {row.status !== "SUSPENDED" ? (
                        <button
                          type="button"
                          className={dangerBtn}
                          disabled={busyId === row.id}
                          onClick={() => void setStatus(row.id, "SUSPENDED")}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={ghostBtn}
                          disabled={busyId === row.id}
                          onClick={() => void setStatus(row.id, "ACTIVE")}
                        >
                          Restore
                        </button>
                      )}
                    </div>
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
