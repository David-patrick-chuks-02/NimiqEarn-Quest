"use client";

import { useCallback, useEffect, useState } from "react";
import type { Quest, QuestFilter, StudioSubmission } from "./types";
import { primaryBtn } from "./styles";

const QUEST_PAGE_SIZE = 6;

interface QuestListProps {
  quests: Quest[];
  publishingId: string | null;
  sharedId: string | null;
  promotingId: string | null;
  promotion: { promotionAvailable: boolean; promotionFeeNim: number };
  onPublish: (quest: Quest) => void;
  onShare: (id: string) => void;
  onViewAnalytics: (quest: Quest) => void;
  onPromote: (id: string) => void;
  onReview: (quest: Quest) => void;
}

// The Quests tab: filter toolbar + paginated quest cards (each with its OG-card preview).
export function QuestsPanel(props: QuestListProps) {
  const [filter, setFilter] = useState<QuestFilter>({ status: "all", promotedOnly: false });
  const [page, setPage] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = props.quests.filter((q) => {
    if (filter.status !== "all" && q.status !== filter.status) return false;
    if (filter.promotedOnly && !q.promoted) return false;
    return true;
  });
  const activeFilters = (filter.status !== "all" ? 1 : 0) + (filter.promotedOnly ? 1 : 0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / QUEST_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * QUEST_PAGE_SIZE, safePage * QUEST_PAGE_SIZE + QUEST_PAGE_SIZE);

  if (props.quests.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <p className="text-sm font-semibold text-white">No quests yet</p>
        <p className="mt-1 text-sm text-[var(--brand-muted)]">
          Head to the Create tab to draft your first quest.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--brand-muted)]">
          {filtered.length} {filtered.length === 1 ? "quest" : "quests"}
        </p>
        <button
          onClick={() => setFilterOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:border-white/25"
        >
          <FilterIcon />
          Filter
          {activeFilters > 0 && (
            <span className="rounded-full bg-[var(--brand-gold)] px-1.5 text-[0.65rem] font-bold text-[var(--brand-ink)]">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-sm text-[var(--brand-muted)]">
          No quests match these filters.
        </div>
      ) : (
        <>
          <QuestList {...props} quests={pageItems} />
          {pageCount > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                className="rounded-full border border-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-sm text-[var(--brand-muted)]">
                Page {safePage + 1} of {pageCount}
              </span>
              <button
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                className="rounded-full border border-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {filterOpen && (
        <FilterModal
          filter={filter}
          onApply={(f) => {
            setFilter(f);
            setPage(0);
            setFilterOpen(false);
          }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M4 5h16M7 12h10M10 19h4" />
    </svg>
  );
}

function FilterModal({
  filter,
  onApply,
  onClose,
}: {
  filter: QuestFilter;
  onApply: (f: QuestFilter) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<QuestFilter>(filter);
  const statuses: { value: QuestFilter["status"]; label: string }[] = [
    { value: "all", label: "All" },
    { value: "PUBLISHED", label: "Published" },
    { value: "DRAFT", label: "Draft" },
    { value: "CLOSED", label: "Closed" },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:px-5"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-sm rounded-t-2xl p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-white">Filter quests</h2>

        <p className="eyebrow mt-4">Status</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {statuses.map((s) => {
            const on = draft.status === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setDraft({ ...draft, status: s.value })}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  on
                    ? "bg-[var(--brand-gold)] text-[var(--brand-ink)]"
                    : "border border-white/10 text-white hover:border-white/25"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <label className="mt-5 flex cursor-pointer items-center justify-between">
          <span className="text-sm font-semibold text-white">Promoted only</span>
          <input
            type="checkbox"
            checked={draft.promotedOnly}
            onChange={(e) => setDraft({ ...draft, promotedOnly: e.target.checked })}
            className="h-5 w-5 accent-[var(--brand-gold)]"
          />
        </label>

        <button onClick={() => onApply(draft)} className={`${primaryBtn} mt-5 w-full`}>
          Apply
        </button>
        <button
          onClick={() => onApply({ status: "all", promotedOnly: false })}
          className="mt-2 w-full py-1.5 text-sm font-semibold text-[var(--brand-muted)] transition hover:text-white"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}

function QuestList({
  quests,
  publishingId,
  sharedId,
  promotingId,
  promotion,
  onPublish,
  onShare,
  onViewAnalytics,
  onPromote,
  onReview,
}: QuestListProps) {
  return (
    <div className="space-y-2.5">
      {quests.map((q) => {
        return (
          <div
            key={q.id}
            className={`glass overflow-hidden rounded-xl ${q.promoted ? "border-[var(--brand-gold)]/40" : ""}`}
          >
            {q.status !== "DRAFT" && (
              // The shareable OG card (non-counting thumbnail) — a visual preview of the quest.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/q/${q.id}/opengraph-image`}
                alt=""
                loading="lazy"
                className="aspect-[1200/630] w-full border-b border-white/10 object-cover"
              />
            )}
            <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-semibold text-white">{q.title}</p>
              <div className="flex shrink-0 items-center gap-1.5">
                {q.promoted && <Tag label="Promoted" gold />}
                {q.scheduled && <Tag label="Scheduled" />}
                <StatusBadge status={q.status} />
              </div>
            </div>

            {q.scheduled && q.startAt && (
              <p className="mt-1.5 text-xs text-[var(--brand-muted)]">
                Starts {new Date(q.startAt).toLocaleString()}
              </p>
            )}

            <div className="mt-2.5 grid grid-cols-4 gap-2">
              <Metric label="Views" value={q.viewCount.toLocaleString()} />
              <Metric label="Reward" value={Number(q.rewardAmount).toLocaleString()} />
              <Metric label="Slots" value={`${q.filledSlots}/${q.totalSlots}`} />
              <Metric label="Pool" value={(Number(q.rewardAmount) * q.totalSlots).toLocaleString()} />
            </div>

            {q.status === "DRAFT" && (
              <button
                onClick={() => onPublish(q)}
                disabled={publishingId === q.id}
                className={`${primaryBtn} mt-3 w-full`}
              >
                {publishingId === q.id ? "Publishing…" : "Publish"}
              </button>
            )}

            {q.status === "PUBLISHED" && (
              <button
                onClick={() => onReview(q)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/25"
              >
                Review submissions
              </button>
            )}

            {q.status === "PUBLISHED" && (
              <button
                onClick={() => onShare(q.id)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--brand-gold)]/40 px-4 py-2 text-sm font-semibold text-[var(--brand-gold)] transition hover:bg-[var(--brand-gold)]/10"
              >
                {sharedId === q.id ? "Link copied" : "Share quest link"}
              </button>
            )}

            {q.status === "PUBLISHED" && !q.promoted && promotion.promotionAvailable && (
              <button
                onClick={() => onPromote(q.id)}
                disabled={promotingId === q.id}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--brand-gold)]/40 px-4 py-2 text-sm font-semibold text-[var(--brand-gold)] transition hover:bg-[var(--brand-gold)]/10 disabled:opacity-60"
              >
                {promotingId === q.id
                  ? "Promoting…"
                  : `Promote — ${promotion.promotionFeeNim.toLocaleString()} NIM`}
              </button>
            )}

            {q.status !== "DRAFT" && (
              <button
                onClick={() => onViewAnalytics(q)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/25"
              >
                View analytics
              </button>
            )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tag({ label, gold }: { label: string; gold?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${
        gold ? "bg-[var(--brand-gold)]/20 text-[var(--brand-gold)]" : "bg-white/10 text-[var(--brand-muted)]"
      }`}
    >
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-center">
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[0.6rem] uppercase tracking-wide text-[var(--brand-muted)]">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: Quest["status"] }) {
  const styles: Record<Quest["status"], string> = {
    DRAFT: "bg-white/10 text-[var(--brand-muted)]",
    PUBLISHED: "bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]",
    CLOSED: "bg-white/10 text-[var(--brand-muted)]",
    ARCHIVED: "bg-white/10 text-[var(--brand-muted)]",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {status.toLowerCase()}
    </span>
  );
}

export function SubmissionsReviewModal({
  quest,
  api,
  onClose,
  onChanged,
}: {
  quest: Quest;
  api: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [subs, setSubs] = useState<StudioSubmission[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const body = (await api(`/api/studio/quests/${quest.id}/submissions`)) as {
        submissions?: StudioSubmission[];
      };
      setSubs(body.submissions ?? []);
    } catch (e) {
      setError((e as Error).message);
      setSubs([]);
    }
  }, [api, quest.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "accept" | "reject") => {
    setBusyId(id);
    setError("");
    try {
      await api(`/api/studio/submissions/${id}/${action}`, { method: "POST" });
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:px-5"
      onClick={onClose}
    >
      <div
        className="glass max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Submissions</h2>
            <p className="mt-0.5 text-sm text-[var(--brand-muted)]">{quest.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-sm text-white"
          >
            Close
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {subs === null ? (
          <p className="mt-4 text-sm text-[var(--brand-muted)]">Loading…</p>
        ) : subs.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--brand-muted)]">No submissions yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {subs.map((s) => {
              const label =
                s.worker.displayName ||
                (s.worker.username ? `@${s.worker.username}` : s.worker.telegramId);
              const isImage = s.proof.startsWith("data:image/");
              return (
                <li key={s.id} className="rounded-xl border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">{label}</p>
                    <span className="text-[0.65rem] uppercase tracking-wide text-[var(--brand-muted)]">
                      {s.status}
                    </span>
                  </div>
                  {(s.verificationOutcome || s.confidenceScore != null) && (
                    <p className="mt-1 text-[0.7rem] text-[var(--brand-gold)]">
                      AI: {s.verificationOutcome ?? "—"}
                      {s.confidenceScore != null
                        ? ` · ${(s.confidenceScore * 100).toFixed(0)}% confidence`
                        : ""}
                      {s.moderationQueue === "PLATFORM" || s.verificationOutcome === "MANUAL_REVIEW"
                        ? " · platform queue"
                        : ""}
                    </p>
                  )}
                  {s.status === "PENDING" &&
                    (s.moderationQueue === "PLATFORM" ||
                      s.verificationOutcome === "MANUAL_REVIEW") && (
                      <p className="mt-2 text-xs text-[var(--brand-muted)]">
                        Waiting on platform moderation — not reviewable in Studio.
                      </p>
                    )}
                  <p className="mt-1 text-[0.7rem] text-[var(--brand-muted)]">
                    {new Date(s.createdAt).toLocaleString()}
                  </p>
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.proof} alt="Proof" className="mt-2 max-h-48 w-full rounded-lg object-contain" />
                  ) : (
                    <p className="mt-2 break-all text-sm text-white/90">{s.proof}</p>
                  )}
                  {s.payoutTxUrl && (
                    <a
                      href={s.payoutTxUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-[var(--brand-gold)] underline"
                    >
                      View payout
                    </a>
                  )}
                  {s.status === "PENDING" && s.creatorCanReview !== false && (
                    <div className="mt-3 flex gap-2">
                      <button
                        disabled={busyId === s.id}
                        onClick={() => void act(s.id, "accept")}
                        className={`${primaryBtn} flex-1 py-2`}
                      >
                        {busyId === s.id ? "…" : "Accept & pay"}
                      </button>
                      <button
                        disabled={busyId === s.id}
                        onClick={() => void act(s.id, "reject")}
                        className="flex-1 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {s.status === "ACCEPTED" && !s.payoutTxUrl && (
                    <button
                      disabled={busyId === s.id}
                      onClick={() => void act(s.id, "accept")}
                      className={`${primaryBtn} mt-3 w-full py-2`}
                    >
                      {busyId === s.id ? "…" : "Retry payout"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

