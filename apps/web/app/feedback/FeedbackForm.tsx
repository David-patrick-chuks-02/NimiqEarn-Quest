"use client";

import { useState } from "react";

const MAX_MESSAGE = 2000;
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]";
const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[var(--brand-navy-900)]/80 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-[var(--brand-muted)]/60 transition focus:border-[var(--brand-gold)]/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-55";

const RATING_HINTS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Okay",
  4: "Good",
  5: "Excellent",
};

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={`${className} shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current`}
      aria-hidden
    />
  );
}

export function FeedbackForm() {
  const [displayName, setDisplayName] = useState("");
  const [telegramHandle, setTelegramHandle] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending || !message.trim()) return;
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          displayName: displayName.trim() || undefined,
          telegramHandle: telegramHandle.trim() || undefined,
          rating: rating ?? undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setDone(true);
      setMessage("");
      setDisplayName("");
      setTelegramHandle("");
      setRating(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="glass mt-14 rounded-2xl border-white/[0.1] px-6 py-14 text-center sm:px-12">
        <p className="eyebrow text-[var(--brand-gold)]">Received</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Thank you</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--brand-muted)]">
          Your note was saved and will be reviewed with the rest of the community feedback.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-8 inline-flex items-center justify-center rounded-lg border border-white/12 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/5"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="glass relative mt-14 overflow-hidden rounded-2xl"
      noValidate
      aria-busy={sending}
    >
      {sending && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--brand-navy-900)]/70 px-6 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[var(--brand-navy-800)] px-5 py-4 shadow-lg">
            <Spinner className="h-5 w-5 text-[var(--brand-gold)]" />
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Sending feedback…</p>
              <p className="mt-0.5 text-xs text-[var(--brand-muted)]">This usually takes a second</p>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-white/[0.06] px-6 py-6 sm:px-8">
        <h2 className="text-xl font-semibold tracking-tight text-white">Feedback form</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--brand-muted)]">
          Specific notes beat vague ones — mention the screen, command, or step if something broke.
        </p>
      </div>

      <fieldset disabled={sending} className="min-w-0 space-y-8 border-0 p-0 px-6 py-8 sm:px-8">
        <div>
          <div className="flex items-end justify-between gap-3">
            <label htmlFor="fb-msg" className={labelClass}>
              Your feedback <span className="text-[var(--brand-gold)]">*</span>
            </label>
            <span
              className={`text-xs tabular-nums ${
                message.length > MAX_MESSAGE - 100
                  ? "text-[var(--brand-gold)]"
                  : "text-[var(--brand-muted)]"
              }`}
            >
              {message.length.toLocaleString()} / {MAX_MESSAGE.toLocaleString()}
            </span>
          </div>
          <textarea
            id="fb-msg"
            required
            rows={7}
            maxLength={MAX_MESSAGE}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What worked well? What felt confusing or broken?"
            className={`${inputClass} min-h-[160px] resize-y`}
          />
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <label className={labelClass}>Overall experience</label>
            <span className="text-xs text-[var(--brand-muted)]">
              {rating != null ? `${rating}/5 · ${RATING_HINTS[rating]}` : "Optional"}
            </span>
          </div>
          <div
            className="mt-3 grid grid-cols-5 overflow-hidden rounded-xl border border-white/10"
            role="group"
            aria-label="Rating from 1 to 5"
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const selected = rating === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(selected ? null : n)}
                  className={`relative h-12 text-sm font-semibold transition disabled:cursor-not-allowed ${
                    n > 1 ? "border-l border-white/10" : ""
                  } ${
                    selected
                      ? "bg-[var(--brand-gold)] text-[var(--brand-ink)]"
                      : "text-white hover:bg-white/[0.04] disabled:hover:bg-transparent"
                  }`}
                  aria-pressed={selected}
                  aria-label={`${n} — ${RATING_HINTS[n]}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-[var(--brand-muted)]">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="fb-name" className={labelClass}>
              Name <span className="font-normal normal-case tracking-normal opacity-70">(optional)</span>
            </label>
            <input
              id="fb-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              placeholder="Anonymous"
              autoComplete="nickname"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="fb-tg" className={labelClass}>
              Telegram <span className="font-normal normal-case tracking-normal opacity-70">(optional)</span>
            </label>
            <input
              id="fb-tg"
              value={telegramHandle}
              onChange={(e) => setTelegramHandle(e.target.value)}
              maxLength={64}
              placeholder="@username"
              autoComplete="off"
              className={inputClass}
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-4 border-t border-white/[0.06] bg-white/[0.015] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="max-w-sm text-xs leading-relaxed text-[var(--brand-muted)]">
          Submissions are stored for product review only. We do not publish individual responses.
        </p>
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="inline-flex min-w-[168px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--brand-gold)] px-7 py-2.5 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-gold-600)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? (
            <>
              <Spinner className="h-4 w-4 text-[var(--brand-ink)]" />
              Sending…
            </>
          ) : (
            "Submit feedback"
          )}
        </button>
      </div>
    </form>
  );
}
