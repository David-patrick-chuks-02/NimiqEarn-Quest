"use client";

import type { Quest } from "./types";
import { primaryBtn } from "./styles";

/**
 * Publish confirmation. Pre-checks the creator's on-chain balance against the quest's reward
 * pool and blocks the Publish button when it's short — before any request is made. When the
 * balance can't be read (RPC down), it lets the user proceed and the server enforces funding.
 */
// After the create form, ask whether to publish now (funds it) or just save a draft.
export function CreateConfirmModal({
  payload,
  feePercent,
  balance,
  onCancel,
  onDraft,
  onPublish,
}: {
  payload: Record<string, unknown>;
  feePercent: number;
  balance: { nim: number | null; reachable: boolean };
  onCancel: () => void;
  onDraft: () => void;
  onPublish: () => void;
}) {
  const reward = Number(payload.rewardAmount) || 0;
  const slots = Number(payload.totalSlots) || 0;
  const pool = reward * slots;
  const fee = Math.round(pool * (feePercent / 100));
  const total = pool + fee;
  const known = balance.reachable && balance.nim !== null;
  const insufficient = known && (balance.nim ?? 0) < total;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div className="glass w-full max-w-sm rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-white">Publish this quest?</h2>
        <p className="mt-1 text-sm text-[var(--brand-muted)]">
          <span className="text-white">{String(payload.title)}</span>
        </p>

        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-[var(--brand-muted)]">Reward pool</dt>
            <dd className="text-white">{pool.toLocaleString()} NIM</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--brand-muted)]">Platform fee ({feePercent}%)</dt>
            <dd className="text-white">{fee.toLocaleString()} NIM</dd>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
            <dt className="text-[var(--brand-muted)]">Charged to publish</dt>
            <dd className="font-bold text-[var(--brand-gold)]">{total.toLocaleString()} NIM</dd>
          </div>
        </dl>

        {insufficient && (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
            Not enough balance to publish now — save it as a draft and top up, then publish.
          </p>
        )}

        <button
          onClick={onPublish}
          disabled={insufficient}
          className={`${primaryBtn} mt-4 w-full disabled:opacity-50`}
        >
          Publish now
        </button>
        <button
          onClick={onDraft}
          className="mt-2 w-full rounded-full border border-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
        >
          Save as draft
        </button>
        <button
          onClick={onCancel}
          className="mt-2 w-full py-1.5 text-sm font-semibold text-[var(--brand-muted)] transition hover:text-white"
        >
          Keep editing
        </button>
      </div>
    </div>
  );
}

export function PublishConfirmModal({
  quest,
  balance,
  onCancel,
  onConfirm,
}: {
  quest: Quest;
  balance: { nim: number | null; reachable: boolean };
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cost = Number(quest.rewardAmount) * quest.totalSlots;
  const known = balance.reachable && balance.nim !== null;
  const bal = balance.nim ?? 0;
  const insufficient = known && bal < cost;
  const shortfall = Math.max(0, cost - bal);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="glass w-full max-w-sm rounded-2xl p-5">
        <h3 className="text-base font-bold text-white">Publish this quest?</h3>
        <p className="mt-1 truncate text-sm text-[var(--brand-muted)]">{quest.title}</p>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-[var(--brand-muted)]">Reward pool</dt>
            <dd className="font-semibold text-white">{cost.toLocaleString()} NIM</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--brand-muted)]">Your balance</dt>
            <dd className={`font-semibold ${insufficient ? "text-red-400" : "text-white"}`}>
              {known ? `${bal.toLocaleString()} NIM` : "—"}
            </dd>
          </div>
        </dl>

        {insufficient ? (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
            Insufficient balance — you need {shortfall.toLocaleString()} more NIM. Deposit to your
            wallet in the bot, then try again.
          </p>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-[var(--brand-muted)]">
            {cost.toLocaleString()} NIM will be moved from your wallet to fund this quest.
            {!known && " We couldn't confirm your balance — publishing will fail if it's too low."}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Cancel
          </button>
          <button onClick={onConfirm} disabled={insufficient} className={`${primaryBtn} flex-1`}>
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

