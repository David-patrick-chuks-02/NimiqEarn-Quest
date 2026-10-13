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
  ghostBtn,
} from "../../_components/ui";

type QuestDetail = {
  id: string;
  title: string;
  category: string;
  description: string;
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
  proofType: string;
  proofInstructions: string | null;
  verificationConfig: unknown;
  status: string;
  startAt: string | null;
  promoted: boolean;
  createdAt: string;
  publishedAt: string | null;
  viewCount: number;
  escrowAddress: string | null;
  fundedAt: string | null;
  hasEscrowKey: boolean;
  sampleEvidence: string | null;
  creator: {
    id: string;
    telegramId: string;
    telegramUsername: string | null;
    displayName: string | null;
    role: string;
    status: string;
  };
  counts: {
    submissions: number;
    events: number;
    accepted: number;
    rejected: number;
    pending: number;
  };
  recentSubmissions: Array<{
    id: string;
    status: string;
    verificationOutcome: string | null;
    confidenceScore: number | null;
    moderationQueue: string | null;
    payoutTxHash: string | null;
    paidAt: string | null;
    telegramId: string;
    displayName: string | null;
    reputationScore: number;
    createdAt: string;
  }>;
};

export default function AdminQuestDetailPage() {
  const params = useParams<{ id: string }>();
  const { unlocked, adminFetch } = useAdminAuth();
  const [quest, setQuest] = useState<QuestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Cancel + refund flow: two-step (confirm) because it moves money on-chain.
  const [cancelReason, setCancelReason] = useState("");
  const [cancelArmed, setCancelArmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!unlocked || !params.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = (await adminFetch(`/api/admin/quests/${params.id}`)) as QuestDetail;
        if (!cancelled) setQuest(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load quest");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, adminFetch, params.id, reloadKey]);

  async function cancelQuest() {
    if (!quest) return;
    setCancelling(true);
    setError(null);
    setCancelResult(null);
    try {
      const result = (await adminFetch(`/api/admin/quests/${quest.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
      })) as {
        refunded?: boolean;
        refundNim?: number;
        refundTxUrl?: string | null;
        rejectedSubmissions?: number;
      };
      setCancelResult(
        result.refunded
          ? `Cancelled. Refunded ${result.refundNim?.toLocaleString() ?? "?"} NIM to the creator${
              result.rejectedSubmissions
                ? `, and rejected ${result.rejectedSubmissions} open submission(s)`
                : ""
            }.`
          : `Cancelled. Nothing was left in escrow to refund.${
              result.rejectedSubmissions
                ? ` Rejected ${result.rejectedSubmissions} open submission(s).`
                : ""
            }`,
      );
      setCancelArmed(false);
      setCancelReason("");
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel quest");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--brand-muted)]">Loading quest…</p>;
  }
  if (error || !quest) {
    return (
      <div>
        <Link href="/admin/quests" className="text-sm text-[var(--brand-gold)] hover:underline">
          ← Quests
        </Link>
        <p className="mt-4 text-sm text-red-300">{error ?? "Quest not found"}</p>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/quests" className="text-sm text-[var(--brand-gold)] hover:underline">
        ← Quests
      </Link>
      <PageHeader
        title={quest.title}
        description={`${quest.category} · ${quest.proofType}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={quest.status} />
            <CopyId id={quest.id} label="quest" />
          </div>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Created">{formatWhen(quest.createdAt)}</Field>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Published">{formatWhen(quest.publishedAt)}</Field>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Funded">{formatWhen(quest.fundedAt)}</Field>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Starts">{formatWhen(quest.startAt)}</Field>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Reward">{quest.rewardAmount} NIM</Field>
            <Field label="Slots">
              {quest.filledSlots} / {quest.totalSlots} filled
            </Field>
            <Field label="Views">{quest.viewCount}</Field>
            <Field label="Promoted">{quest.promoted ? "Yes" : "No"}</Field>
            <Field label="Escrow address">
              {quest.escrowAddress ? (
                <span className="break-all font-mono text-xs">{quest.escrowAddress}</span>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Escrow key">{quest.hasEscrowKey ? "Present" : "Missing"}</Field>
          </div>
          <div className="mt-4">
            <Field label="Description">
              <p className="whitespace-pre-wrap text-[var(--brand-muted)]">{quest.description}</p>
            </Field>
          </div>
          {quest.proofInstructions && (
            <div className="mt-4">
              <Field label="Proof instructions">
                <p className="whitespace-pre-wrap text-[var(--brand-muted)]">{quest.proofInstructions}</p>
              </Field>
            </div>
          )}
          {quest.sampleEvidence && (
            <div className="mt-4">
              <Field label="Sample evidence">
                <p className="font-mono text-xs text-[var(--brand-muted)]">{quest.sampleEvidence}</p>
              </Field>
            </div>
          )}
          {quest.verificationConfig != null && (
            <div className="mt-4">
              <Field label="Verification config">
                <pre className="max-h-40 overflow-auto rounded-lg bg-black/25 p-2 font-mono text-[0.65rem] text-[var(--brand-muted)]">
                  {JSON.stringify(quest.verificationConfig, null, 2)}
                </pre>
              </Field>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 p-4">
            <h2 className="text-sm font-semibold text-white">Creator</h2>
            <div className="mt-3 space-y-3">
              <Field label="Name">
                <DetailLink href={`/admin/accounts/${quest.creator.id}`}>
                  {quest.creator.displayName ?? quest.creator.telegramId}
                </DetailLink>
              </Field>
              <Field label="Telegram">
                {quest.creator.telegramId}
                {quest.creator.telegramUsername ? ` · @${quest.creator.telegramUsername}` : ""}
              </Field>
              <Field label="Role / status">
                {quest.creator.role} · <StatusPill value={quest.creator.status} />
              </Field>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 p-4">
            <h2 className="text-sm font-semibold text-white">Submission counts</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Total">{quest.counts.submissions}</Field>
              <Field label="Events">{quest.counts.events}</Field>
              <Field label="Accepted">{quest.counts.accepted}</Field>
              <Field label="Rejected">{quest.counts.rejected}</Field>
              <Field label="Pending">{quest.counts.pending}</Field>
            </div>
          </div>

          {quest.status === "PUBLISHED" && (
            <div className="rounded-xl border border-red-400/25 bg-red-500/[0.06] p-4">
              <h2 className="text-sm font-semibold text-red-200">Cancel &amp; refund</h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--brand-muted)]">
                Pulls this quest off the board and returns the unspent escrow to the creator. Open
                submissions are rejected; approved-but-unpaid ones must be settled first.
              </p>
              {cancelArmed ? (
                <div className="mt-3 space-y-3">
                  <input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason (optional, for the audit log)"
                    className="w-full rounded-lg border border-white/12 bg-black/25 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400/30"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void cancelQuest()}
                      disabled={cancelling}
                      className="rounded-lg bg-red-500/80 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                    >
                      {cancelling ? "Refunding…" : "Yes, cancel and refund"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelArmed(false)}
                      disabled={cancelling}
                      className={ghostBtn}
                    >
                      Keep it live
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCancelArmed(true)}
                  className={`${ghostBtn} mt-3 border-red-400/30 text-red-200`}
                >
                  Cancel quest…
                </button>
              )}
              {cancelResult && (
                <p className="mt-3 break-words text-xs text-[var(--brand-gold)]">{cancelResult}</p>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Recent submissions</h2>
          <Link href="/admin/submissions" className={`${ghostBtn} text-xs`}>
            All submissions
          </Link>
        </div>
        {quest.recentSubmissions.length === 0 ? (
          <Empty message="No submissions on this quest yet." />
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[var(--brand-navy-800)] text-[0.65rem] uppercase tracking-[0.08em] text-white/40">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Worker</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Outcome</th>
                  <th className="px-3 py-2.5 font-medium">Created</th>
                  <th className="px-3 py-2.5 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {quest.recentSubmissions.map((s) => (
                  <tr key={s.id} className="bg-[var(--brand-navy-800)]/30">
                    <td className="px-3 py-2.5">
                      <DetailLink href={`/admin/submissions/${s.id}`}>
                        {s.displayName ?? s.telegramId}
                      </DetailLink>
                      <p className="text-xs text-[var(--brand-muted)]">
                        {s.telegramId} · rep {s.reputationScore}
                      </p>
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
                    <td className="px-3 py-2.5 text-[var(--brand-muted)]">
                      {s.paidAt ? formatWhen(s.paidAt) : s.payoutTxHash ? "pending hash" : "—"}
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
