"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminAuth } from "../../_lib/auth";
import { formatWhen } from "../../_lib/utils";
import {
  CopyId,
  DetailLink,
  Empty,
  Field,
  PageHeader,
  StatusPill,
  dangerBtn,
  ghostBtn,
} from "../../_components/ui";

type UserDetail = {
  id: string;
  telegramId: string;
  telegramUsername: string | null;
  displayName: string | null;
  role: string;
  status: string;
  reputationScore: number;
  languageCode: string | null;
  createdAt: string;
  updatedAt: string;
  wallets: Array<{
    id: string;
    nimiqAddress: string;
    status: string;
    isPrimary: boolean;
    custodial: boolean;
    linkedAt: string;
    updatedAt: string;
  }>;
  counts: { quests: number; submissions: number; reputationEvents: number };
  quests: Array<{
    id: string;
    title: string;
    status: string;
    rewardAmount: string;
    totalSlots: number;
    filledSlots: number;
    createdAt: string;
    publishedAt: string | null;
  }>;
  submissions: Array<{
    id: string;
    status: string;
    verificationOutcome: string | null;
    questId: string;
    questTitle: string;
    payoutTxHash: string | null;
    createdAt: string;
  }>;
};

export default function AdminAccountDetailPage() {
  const params = useParams<{ id: string }>();
  const { unlocked, adminFetch } = useAdminAuth();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await adminFetch(`/api/admin/users/${params.id}`)) as UserDetail;
      setUser(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, adminFetch, params.id]);

  async function setStatus(status: "ACTIVE" | "SUSPENDED") {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/users/${user.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--brand-muted)]">Loading account…</p>;
  }
  if (error && !user) {
    return (
      <div>
        <Link href="/admin/accounts" className="text-sm text-[var(--brand-gold)] hover:underline">
          ← Accounts
        </Link>
        <p className="mt-4 text-sm text-red-300">{error}</p>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div>
      <Link href="/admin/accounts" className="text-sm text-[var(--brand-gold)] hover:underline">
        ← Accounts
      </Link>
      <PageHeader
        title={user.displayName ?? user.telegramId}
        description={`${user.role} · tg ${user.telegramId}${user.telegramUsername ? ` · @${user.telegramUsername}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={user.status} />
            <CopyId id={user.id} label="user" />
            {user.status !== "SUSPENDED" ? (
              <button
                type="button"
                className={dangerBtn}
                disabled={busy}
                onClick={() => void setStatus("SUSPENDED")}
              >
                Suspend
              </button>
            ) : (
              <button
                type="button"
                className={ghostBtn}
                disabled={busy}
                onClick={() => void setStatus("ACTIVE")}
              >
                Restore
              </button>
            )}
          </div>
        }
      />

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Created">{formatWhen(user.createdAt)}</Field>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Updated">{formatWhen(user.updatedAt)}</Field>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Reputation">{user.reputationScore}</Field>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Language">{user.languageCode ?? "—"}</Field>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 p-4">
          <Field label="Quests created">{user.counts.quests}</Field>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 p-4">
          <Field label="Submissions">{user.counts.submissions}</Field>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 p-4">
          <Field label="Reputation events">{user.counts.reputationEvents}</Field>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-white">Wallets</h2>
        {user.wallets.length === 0 ? (
          <Empty message="No wallets linked." />
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[var(--brand-navy-800)] text-[0.65rem] uppercase tracking-[0.08em] text-white/40">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Address</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Primary</th>
                  <th className="px-3 py-2.5 font-medium">Custodial</th>
                  <th className="px-3 py-2.5 font-medium">Linked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {user.wallets.map((w) => (
                  <tr key={w.id} className="bg-[var(--brand-navy-800)]/30">
                    <td className="px-3 py-2.5 font-mono text-xs break-all">{w.nimiqAddress}</td>
                    <td className="px-3 py-2.5">
                      <StatusPill value={w.status} />
                    </td>
                    <td className="px-3 py-2.5 text-[var(--brand-muted)]">{w.isPrimary ? "Yes" : "No"}</td>
                    <td className="px-3 py-2.5 text-[var(--brand-muted)]">{w.custodial ? "Yes" : "No"}</td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                      {formatWhen(w.linkedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-white">Created quests</h2>
        {user.quests.length === 0 ? (
          <Empty message="No quests created." />
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[var(--brand-navy-800)] text-[0.65rem] uppercase tracking-[0.08em] text-white/40">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Quest</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Reward</th>
                  <th className="px-3 py-2.5 font-medium">Slots</th>
                  <th className="px-3 py-2.5 font-medium">Created</th>
                  <th className="px-3 py-2.5 font-medium">Published</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {user.quests.map((q) => (
                  <tr key={q.id} className="bg-[var(--brand-navy-800)]/30">
                    <td className="px-3 py-2.5">
                      <DetailLink href={`/admin/quests/${q.id}`}>{q.title}</DetailLink>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill value={q.status} />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{q.rewardAmount} NIM</td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                      {q.filledSlots}/{q.totalSlots}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                      {formatWhen(q.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                      {formatWhen(q.publishedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-white">Recent submissions</h2>
        {user.submissions.length === 0 ? (
          <Empty message="No submissions." />
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[var(--brand-navy-800)] text-[0.65rem] uppercase tracking-[0.08em] text-white/40">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Quest</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Outcome</th>
                  <th className="px-3 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {user.submissions.map((s) => (
                  <tr key={s.id} className="bg-[var(--brand-navy-800)]/30">
                    <td className="px-3 py-2.5">
                      <DetailLink href={`/admin/submissions/${s.id}`}>{s.questTitle}</DetailLink>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill value={s.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      {s.verificationOutcome ? <StatusPill value={s.verificationOutcome} /> : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--brand-muted)]">
                      {formatWhen(s.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
