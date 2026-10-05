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
  acceptBtn,
  dangerBtn,
  ghostBtn,
} from "../../_components/ui";

type SubmissionDetail = {
  id: string;
  status: string;
  verificationOutcome: string | null;
  confidenceScore: number | null;
  verificationSignals: unknown;
  moderationQueue: string | null;
  proof: string;
  contentHash: string | null;
  clientFingerprint: string | null;
  ipHash: string | null;
  payoutTxHash: string | null;
  paidAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    telegramUsername: string | null;
    displayName: string | null;
    reputationScore: number;
    status: string;
    role: string;
  };
  quest: {
    id: string;
    title: string;
    status: string;
    proofType: string;
    rewardAmount: string;
    escrowAddress: string | null;
  };
  moderationEvents: Array<{
    id: string;
    flagType: string;
    resolution: string;
    detail: unknown;
    createdAt: string;
  }>;
};

export default function AdminSubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const { unlocked, adminFetch } = useAdminAuth();
  const [row, setRow] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await adminFetch(`/api/admin/submissions/${params.id}`)) as SubmissionDetail;
      setRow(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load submission");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, adminFetch, params.id]);

  async function act(action: "accept" | "reject") {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/submissions/${row.id}/${action}`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--brand-muted)]">Loading submission…</p>;
  }
  if (error && !row) {
    return (
      <div>
        <Link href="/admin/submissions" className="text-sm text-[var(--brand-gold)] hover:underline">
          ← Submissions
        </Link>
        <p className="mt-4 text-sm text-red-300">{error}</p>
      </div>
    );
  }
  if (!row) return null;

  const canReview = row.status === "PENDING";

  return (
    <div>
      <Link href="/admin/submissions" className="text-sm text-[var(--brand-gold)] hover:underline">
        ← Submissions
      </Link>
      <PageHeader
        title={row.quest.title}
        description={`Submission · ${row.quest.proofType} · reward ${row.quest.rewardAmount} NIM`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={row.status} />
            <CopyId id={row.id} label="sub" />
          </div>
        }
      />

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {canReview && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={acceptBtn} disabled={busy} onClick={() => void act("accept")}>
            Accept & pay
          </button>
          <button type="button" className={dangerBtn} disabled={busy} onClick={() => void act("reject")}>
            Reject
          </button>
          <Link href="/admin/queue" className={ghostBtn}>
            Back to queue
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Created">{formatWhen(row.createdAt)}</Field>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Verified">{formatWhen(row.verifiedAt)}</Field>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Paid">{formatWhen(row.paidAt)}</Field>
        </div>
        <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/50 p-4">
          <Field label="Queue">{row.moderationQueue ?? "—"}</Field>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Proof & verification</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Outcome">
              {row.verificationOutcome ? <StatusPill value={row.verificationOutcome} /> : "—"}
            </Field>
            <Field label="Confidence">
              {row.confidenceScore != null ? `${(row.confidenceScore * 100).toFixed(1)}%` : "—"}
            </Field>
            <Field label="Content hash">
              <span className="break-all font-mono text-xs">{row.contentHash ?? "—"}</span>
            </Field>
            <Field label="Payout tx">
              <span className="break-all font-mono text-xs">{row.payoutTxHash ?? "—"}</span>
            </Field>
            <Field label="Client fingerprint">
              <span className="break-all font-mono text-xs">{row.clientFingerprint ?? "—"}</span>
            </Field>
            <Field label="IP hash">
              <span className="break-all font-mono text-xs">{row.ipHash ?? "—"}</span>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Proof">
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/25 p-3 font-mono text-[0.7rem] text-[var(--brand-muted)]">
                {row.proof}
              </pre>
            </Field>
          </div>
          {row.verificationSignals != null && (
            <div className="mt-4">
              <Field label="Verification signals">
                <pre className="max-h-48 overflow-auto rounded-lg bg-black/25 p-3 font-mono text-[0.65rem] text-[var(--brand-muted)]">
                  {JSON.stringify(row.verificationSignals, null, 2)}
                </pre>
              </Field>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 p-4">
            <h2 className="text-sm font-semibold text-white">Worker</h2>
            <div className="mt-3 space-y-3">
              <Field label="Name">
                <DetailLink href={`/admin/accounts/${row.user.id}`}>
                  {row.user.displayName ?? row.user.telegramId}
                </DetailLink>
              </Field>
              <Field label="Telegram">
                {row.user.telegramId}
                {row.user.telegramUsername ? ` · @${row.user.telegramUsername}` : ""}
              </Field>
              <Field label="Reputation">{row.user.reputationScore}</Field>
              <Field label="Status">
                <StatusPill value={row.user.status} /> · {row.user.role}
              </Field>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 p-4">
            <h2 className="text-sm font-semibold text-white">Quest</h2>
            <div className="mt-3 space-y-3">
              <Field label="Title">
                <DetailLink href={`/admin/quests/${row.quest.id}`}>{row.quest.title}</DetailLink>
              </Field>
              <Field label="Status">
                <StatusPill value={row.quest.status} />
              </Field>
              <Field label="Escrow">
                <span className="break-all font-mono text-xs">{row.quest.escrowAddress ?? "—"}</span>
              </Field>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-white">Moderation history</h2>
        {row.moderationEvents.length === 0 ? (
          <Empty message="No moderation events for this submission." />
        ) : (
          <div className="mt-3 space-y-2">
            {row.moderationEvents.map((e) => (
              <article
                key={e.id}
                className="rounded-xl border border-white/10 bg-[var(--brand-navy-800)]/40 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-white">
                    {e.flagType} → {e.resolution}
                  </p>
                  <p className="text-xs tabular-nums text-[var(--brand-muted)]">
                    {formatWhen(e.createdAt)}
                  </p>
                </div>
                {e.detail != null && (
                  <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-black/25 p-2 font-mono text-[0.65rem] text-[var(--brand-muted)]">
                    {typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail, null, 2)}
                  </pre>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
