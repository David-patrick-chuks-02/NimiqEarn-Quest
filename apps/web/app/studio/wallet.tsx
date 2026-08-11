"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FaucetQuote, WalletTx } from "./types";
import {
  FAUCET_DEFAULT_NIM,
  FAUCET_MAX_NIM_UI,
  FAUCET_PRESETS_UI,
} from "./constants";
import { primaryBtn } from "./styles";
import { formatNim } from "./utils";
import { Spinner } from "./chrome";

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


// Wallet tab — the creator's custodial wallet that funds their quests. This is the one place
// the full address is shown (deposit here to top up), with a tap-to-copy.

function WalletTxRow({ t }: { t: WalletTx }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">
          {t.direction === "in" ? "Received" : "Sent"}
        </p>
        <a
          href={t.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-[var(--brand-muted)] transition hover:text-[var(--brand-gold)]"
        >
          {t.hash.slice(0, 8)}…{t.hash.slice(-6)}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3 w-3" aria-hidden>
            <path d="M14 5h5v5M19 5l-9 9M12 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-bold ${
            t.direction === "in" ? "text-emerald-400" : "text-white"
          }`}
        >
          {t.direction === "in" ? "+" : "−"}
          {t.amountNim.toLocaleString()} NIM
        </p>
        {t.timestamp && (
          <p className="text-[0.7rem] text-[var(--brand-muted)]">
            {new Date(t.timestamp).toLocaleDateString()}
          </p>
        )}
      </div>
    </li>
  );
}

type TxDirectionFilter = "all" | "in" | "out";
const TX_PAGE_SIZE = 10;
const TX_PREVIEW_COUNT = 4;

function WalletTransactionsPanel({
  txs,
  txSupported,
  onBack,
}: {
  txs: WalletTx[] | null;
  txSupported: boolean;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState<TxDirectionFilter>("all");
  const [page, setPage] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = (txs ?? []).filter((t) => {
    if (filter === "in") return t.direction === "in";
    if (filter === "out") return t.direction === "out";
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / TX_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(
    safePage * TX_PAGE_SIZE,
    safePage * TX_PAGE_SIZE + TX_PAGE_SIZE,
  );
  const activeFilters = filter !== "all" ? 1 : 0;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-semibold text-[var(--brand-gold)] transition hover:text-white"
      >
        ← Back to wallet
      </button>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--brand-muted)]">
          {filtered.length} {filtered.length === 1 ? "transaction" : "transactions"}
        </p>
        <button
          type="button"
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

      {txs === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-white/10" />
          ))}
        </div>
      ) : !txSupported ? (
        <p className="text-sm text-[var(--brand-muted)]">
          Transaction history isn&apos;t available right now.
        </p>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-sm text-[var(--brand-muted)]">
          No transactions match these filters.
        </div>
      ) : (
        <>
          <ul className="glass divide-y divide-white/5 rounded-2xl px-5">
            {pageItems.map((t) => (
              <WalletTxRow key={t.hash} t={t} />
            ))}
          </ul>
          {pageCount > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
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
                type="button"
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
        <TxFilterModal
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

function TxFilterModal({
  filter,
  onApply,
  onClose,
}: {
  filter: TxDirectionFilter;
  onApply: (f: TxDirectionFilter) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(filter);
  const options: { value: TxDirectionFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "in", label: "Received" },
    { value: "out", label: "Sent" },
  ];
  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:px-5"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-sm rounded-t-2xl p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-white">Filter transactions</h2>
        <p className="eyebrow mt-4">Direction</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((o) => {
            const on = draft === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setDraft(o.value)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  on
                    ? "bg-[var(--brand-gold)] text-[var(--brand-ink)]"
                    : "border border-white/10 text-white hover:border-white/25"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => onApply(draft)} className={`${primaryBtn} mt-5 w-full`}>
          Apply
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full py-2 text-sm font-semibold text-[var(--brand-muted)] transition hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function WalletTab({
  balance,
  balanceAnim,
  api,
  onTxViewChange,
  onRequestFaucet,
}: {
  balance: { nim: number | null; reachable: boolean; address: string | null };
  balanceAnim?: { from: number; to: number } | null;
  api: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onTxViewChange?: (open: boolean) => void;
  onRequestFaucet: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [txs, setTxs] = useState<WalletTx[] | null>(null);
  const [txSupported, setTxSupported] = useState(true);
  const [showAllTx, setShowAllTx] = useState(false);
  const known = balance.reachable && balance.nim !== null;
  const isTestnet = process.env.NEXT_PUBLIC_HUB_URL?.includes("testnet");

  useEffect(() => {
    let active = true;
    api("/api/studio/transactions")
      .then((body) => {
        if (!active) return;
        const b = body as { supported?: boolean; transactions?: WalletTx[] };
        setTxSupported(Boolean(b.supported));
        setTxs(b.transactions ?? []);
      })
      .catch(() => {
        if (!active) return;
        setTxSupported(false);
        setTxs([]);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const copy = async () => {
    if (!balance.address) return;
    try {
      await navigator.clipboard.writeText(balance.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — no-op.
    }
  };

  useEffect(() => {
    onTxViewChange?.(showAllTx);
  }, [showAllTx, onTxViewChange]);

  if (showAllTx) {
    return (
      <WalletTransactionsPanel
        txs={txs}
        txSupported={txSupported}
        onBack={() => setShowAllTx(false)}
      />
    );
  }

  const previewTxs = txs?.slice(0, TX_PREVIEW_COUNT) ?? [];

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-6 text-center">
        <p className="eyebrow">Available balance</p>
        {known ? (
          <div className="mt-2">
            <AnimatedNimBalance value={balance.nim} bump={balanceAnim} size="lg" />
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--brand-muted)]">Couldn&apos;t load balance</p>
        )}
        {isTestnet && (
          <button type="button" onClick={onRequestFaucet} className={`${primaryBtn} mt-5 w-full`}>
            Get free testnet NIM
          </button>
        )}
      </div>

      {balance.address && (
        <div className="glass rounded-2xl p-5">
          <p className="eyebrow">Deposit address</p>
          <p className="mt-2 break-all rounded-xl bg-black/20 px-3.5 py-3 font-mono text-sm text-white">
            {balance.address}
          </p>
          <button onClick={() => void copy()} className={`${primaryBtn} mt-3 w-full`}>
            {copied ? "Copied" : "Copy address"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-[var(--brand-muted)]">
            Send NIM to this address to fund your quests. Publishing a quest charges its reward
            pool from this balance.
          </p>
        </div>
      )}

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="eyebrow">Transaction history</p>
            <span className="text-[0.7rem] text-[var(--brand-muted)]">on-chain · verifiable</span>
          </div>
          {txs && txs.length > TX_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllTx(true)}
              className="shrink-0 text-sm font-semibold text-[var(--brand-gold)] transition hover:text-white"
            >
              View all
            </button>
          )}
        </div>

        {txs === null ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-white/10" />
            ))}
          </div>
        ) : !txSupported ? (
          <p className="mt-3 text-sm text-[var(--brand-muted)]">
            Transaction history isn&apos;t available right now.
          </p>
        ) : txs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--brand-muted)]">No transactions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {previewTxs.map((t) => (
              <WalletTxRow key={t.hash} t={t} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


// Smooth count-up when balance increases (e.g. after faucet credit lands).
// Always animates from bump.from (current) → bump.to (new). Ignores `value`
// while a bump is active so a premature balance refresh can't jump the number.
function AnimatedNimBalance({
  value,
  bump,
  className = "",
  size = "md",
}: {
  value: number | null;
  bump?: { from: number; to: number } | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const from = bump?.from;
  const to = bump?.to;
  const animating = from != null && to != null;
  const [display, setDisplay] = useState(() => from ?? value ?? 0);
  const animRef = useRef<number | null>(null);

  // Count from current → new when a bump arrives.
  useEffect(() => {
    if (!animating) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setDisplay(from);
    const start = performance.now();
    const duration = 1600;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
        setDisplay(to);
      }
    };
    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [animating, from, to]);

  // Sync to live balance only when not counting up.
  useEffect(() => {
    if (animating) return;
    if (value != null) setDisplay(value);
  }, [animating, value]);

  const sizeClass =
    size === "lg" ? "text-4xl" : size === "sm" ? "text-xl" : "text-4xl";
  const nimClass = size === "sm" ? "text-sm" : "text-lg";

  if (value == null && !animating) {
    return <p className="mt-1 text-sm text-[var(--brand-muted)]">Couldn&apos;t load balance</p>;
  }

  // Whole NIM during the count-up reads cleaner than fractional ticks.
  const shown = Math.round(display);

  return (
    <p className={`font-bold tracking-tight ${sizeClass} ${className}`}>
      <span className="text-gradient-gold">{shown.toLocaleString()}</span>
      <span className={`ml-2 font-semibold text-[var(--brand-muted)] ${nimClass}`}>NIM</span>
    </p>
  );
}

// Creator's on-chain wallet balance, surfaced up front so they know their funding
// headroom before drafting — the publish modal re-checks it against the reward.
export function WalletCard({
  balance,
  balanceAnim,
  onRequestFaucet,
}: {
  balance: { nim: number | null; reachable: boolean };
  balanceAnim?: { from: number; to: number } | null;
  onRequestFaucet: () => void;
}) {
  const known = balance.reachable && balance.nim !== null;
  const isTestnet = process.env.NEXT_PUBLIC_HUB_URL?.includes("testnet");

  return (
    <div className="glass flex flex-col justify-between rounded-2xl px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow flex items-center gap-2">
            Wallet balance
            {isTestnet && (
              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-blue-400">
                TESTNET
              </span>
            )}
          </p>
          {known ? (
            <div className="mt-1">
              <AnimatedNimBalance value={balance.nim} bump={balanceAnim} size="sm" />
            </div>
          ) : (
            <p className="mt-1 text-sm text-[var(--brand-muted)]">Couldn&apos;t load balance</p>
          )}
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-[var(--brand-muted)]"
          aria-hidden
        >
          <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M16 12h.01M3 9h18" />
        </svg>
      </div>
      {isTestnet && (
        <button
          onClick={onRequestFaucet}
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--brand-gold)]/25 bg-[var(--brand-gold)]/10 px-3.5 py-3 text-left transition hover:bg-[var(--brand-gold)]/15 active:scale-[0.99]"
        >
          <div>
            <p className="text-sm font-semibold text-[var(--brand-gold)]">Get free testnet NIM</p>
            <p className="mt-0.5 text-xs text-[var(--brand-muted)]">Instant top-up · up to 1M NIM / wallet</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-gold)] text-[var(--brand-ink)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}


/** Lightweight canvas confetti — no extra dependency. */
function ConfettiBurst({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const colors = ["#F5C518", "#FFD966", "#34D399", "#60A5FA", "#F472B6", "#FFFFFF"];
    const particles = Array.from({ length: 140 }, () => ({
      x: w * (0.3 + Math.random() * 0.4),
      y: h * 0.28 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 10,
      vy: Math.random() * -14 - 5,
      w: Math.random() * 9 + 4,
      h: Math.random() * 7 + 3,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 12,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      opacity: 1,
    }));

    let frame = 0;
    const maxFrames = 130;
    let raf = 0;

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28;
        p.vx *= 0.985;
        p.rot += p.vr;
        if (frame > maxFrames * 0.55) p.opacity -= 0.025;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      frame++;
      if (frame < maxFrames) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[105]"
      aria-hidden
    />
  );
}


function buildFaucetQuoteClient(
  balanceNim: number | null,
  reachable: boolean,
  requestedNim: number,
): FaucetQuote {
  const remainingNim =
    balanceNim !== null ? Math.max(0, Math.floor(FAUCET_MAX_NIM_UI - balanceNim)) : null;
  const want = Math.max(1, Math.floor(requestedNim));
  let amountNim = 0;
  if (remainingNim !== null && remainingNim > 0) {
    amountNim = Math.min(want, remainingNim);
  }
  return {
    presets: [...FAUCET_PRESETS_UI],
    defaultNim: FAUCET_DEFAULT_NIM,
    maxNim: FAUCET_MAX_NIM_UI,
    balanceNim,
    remainingNim,
    requestedNim: want,
    amountNim,
    reachable,
    canRequest: reachable && amountNim > 0,
    capped: remainingNim !== null && remainingNim <= 0,
  };
}

/**
 * Bottom-sheet faucet flow: pick amount → confirm → success with balance count-up.
 * Amounts update instantly client-side; only balance/cap refresh hits the API in the background.
 */
export function FaucetModal({
  api,
  initialBalance,
  onClose,
  onSuccess,
}: {
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  initialBalance: { nim: number | null; reachable: boolean };
  onClose: () => void;
  onSuccess: (detail: { from: number; to: number }) => void;
}) {
  const [baseBalance, setBaseBalance] = useState(initialBalance);
  const [phase, setPhase] = useState<"ready" | "sending" | "done">("ready");
  const [error, setError] = useState("");
  const [selectedNim, setSelectedNim] = useState(FAUCET_DEFAULT_NIM);
  const [customNim, setCustomNim] = useState("");
  const [sent, setSent] = useState<{ nim: number; from: number; to: number } | null>(null);

  const customParsed = customNim.trim() ? Math.floor(Number(customNim.trim())) : null;
  const customValid =
    customParsed !== null && Number.isFinite(customParsed) && customParsed > 0;
  const effectiveNim = customValid ? customParsed! : selectedNim;

  const quote = useMemo(
    () => buildFaucetQuoteClient(baseBalance.nim, baseBalance.reachable, effectiveNim),
    [baseBalance.nim, baseBalance.reachable, effectiveNim],
  );

  const refreshBalance = useCallback(async () => {
    try {
      const q = (await api(
        `/api/studio/faucet?amountNim=${FAUCET_DEFAULT_NIM}`,
      )) as FaucetQuote;
      setBaseBalance({ nim: q.balanceNim, reachable: q.reachable });
    } catch {
      // Keep showing the last known balance — non-fatal for the modal.
    }
  }, [api]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    if (phase === "done" || phase === "sending") return;
    const id = window.setInterval(() => void refreshBalance(), 4000);
    return () => window.clearInterval(id);
  }, [phase, refreshBalance]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "sending" && phase !== "done") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  // Let confetti + balance count-up finish before handing off to the parent.
  useEffect(() => {
    if (phase !== "done" || !sent) return;
    const t = window.setTimeout(() => {
      onSuccess({ from: sent.from, to: sent.to });
    }, 2200);
    return () => window.clearTimeout(t);
  }, [phase, sent, onSuccess]);

  const pickPreset = (n: number) => {
    setSelectedNim(n);
    setCustomNim("");
    setError("");
  };

  const request = async () => {
    if (!quote.canRequest || phase === "sending" || (customNim.trim() && !customValid)) return;
    setPhase("sending");
    setError("");
    try {
      const result = (await api("/api/studio/faucet", {
        method: "POST",
        body: JSON.stringify({ amountNim: quote.amountNim }),
      })) as {
        amountNim?: number;
        balanceBeforeNim?: number | null;
        balanceAfterNim?: number | null;
      };
      const nim = result.amountNim ?? quote.amountNim;
      const from = result.balanceBeforeNim ?? quote.balanceNim ?? 0;
      const to = result.balanceAfterNim ?? from + nim;
      setSent({ nim, from, to });
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("ready");
      void refreshBalance();
    }
  };

  const usedPct =
    quote.balanceNim != null && quote.maxNim > 0
      ? Math.min(100, Math.max(0, (quote.balanceNim / quote.maxNim) * 100))
      : 0;
  const canSend =
    phase === "ready" &&
    quote.canRequest &&
    (!customNim.trim() || customValid);
  const dismissable = phase !== "sending" && phase !== "done";
  const presets = quote.presets;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-[var(--brand-navy-900)]/95 sm:items-center sm:justify-center sm:px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="faucet-title"
      onClick={dismissable ? onClose : undefined}
    >
      <ConfettiBurst active={phase === "done"} />
      <div
        className="animate-slide-up relative z-[101] flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[var(--brand-navy-800)] shadow-[0_-12px_40px_rgba(0,0,0,0.55)] sm:max-h-[85vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/25 sm:hidden" aria-hidden />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 pt-3">
          {phase === "done" && sent ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-7 w-7" aria-hidden>
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 id="faucet-title" className="mt-4 text-xl font-bold text-white">
                Wallet topped up!
              </h3>
              <p className="mt-2 text-sm text-[var(--brand-muted)]">
                {sent.nim.toLocaleString()} NIM was added to your wallet
              </p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--brand-gold)]">
                +{sent.nim.toLocaleString()}{" "}
                <span className="text-base font-semibold text-[var(--brand-muted)]">NIM</span>
              </p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-[var(--brand-navy-900)] px-4 py-4">
                <p className="text-xs text-[var(--brand-muted)]">Balance</p>
                <AnimatedNimBalance
                  value={sent.from}
                  bump={{ from: sent.from, to: sent.to }}
                  size="md"
                  className="mt-1 justify-center"
                />
              </div>
              <p className="mt-3 text-xs font-medium text-emerald-400/90">
                You&apos;re ready to fund quests
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                    Testnet faucet
                  </p>
                  <h3 id="faucet-title" className="mt-1 text-lg font-bold text-white">
                    Top up your wallet
                  </h3>
                  <p className="mt-1 text-sm text-[var(--brand-muted)]">
                    Cap: {formatNim(quote.maxNim)} NIM per wallet
                  </p>
                </div>
                {dismissable && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-[var(--brand-muted)] transition hover:bg-white/10 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="mt-5">
                <p className="text-xs font-medium text-[var(--brand-muted)]">Choose amount</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {presets.map((n) => {
                    const on = effectiveNim === n && !customNim.trim();
                    const disabled = quote.remainingNim != null && n > quote.remainingNim;
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={disabled}
                        onClick={() => pickPreset(n)}
                        className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition disabled:opacity-40 ${
                          on
                            ? "bg-[var(--brand-gold)] text-[var(--brand-ink)]"
                            : "border border-white/10 text-white hover:border-white/25"
                        }`}
                      >
                        {n.toLocaleString()}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="Or enter custom amount"
                  value={customNim}
                  onChange={(e) => {
                    setCustomNim(e.target.value);
                    setError("");
                  }}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-[var(--brand-navy-900)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--brand-muted)] focus:border-[var(--brand-gold)] focus:outline-none"
                />
                {customNim.trim() && !customValid && (
                  <p className="mt-1.5 text-xs text-red-400">Enter a positive NIM amount.</p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-[var(--brand-navy-900)] px-4 py-5 text-center">
                <p className="text-xs font-medium text-[var(--brand-muted)]">You&apos;ll receive</p>
                <p className="mt-1 text-4xl font-bold tracking-tight text-white transition-all duration-150">
                  <span className="text-gradient-gold">{quote.amountNim.toLocaleString()}</span>
                  <span className="ml-1.5 text-base font-semibold text-[var(--brand-muted)]">NIM</span>
                </p>
                {quote.balanceNim != null && (
                  <p className="mt-2 text-xs text-[var(--brand-muted)]">
                    Balance: {formatNim(quote.balanceNim)} →{" "}
                    {formatNim(quote.balanceNim + quote.amountNim)} NIM
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-[var(--brand-navy-900)]/60 px-4 py-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--brand-muted)]">Faucet allowance used</span>
                  <span className="font-medium text-white">
                    {formatNim(quote.balanceNim)} / {formatNim(quote.maxNim)} NIM
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      quote.capped ? "bg-amber-400" : "bg-[var(--brand-gold)]"
                    }`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--brand-muted)]">
                  {quote.capped
                    ? `This wallet has hit the ${formatNim(quote.maxNim)} NIM cap.`
                    : `${formatNim(quote.remainingNim)} NIM left before the cap.`}
                </p>
              </div>

              {error && (
                <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {phase !== "done" && (
          <div
            className="shrink-0 border-t border-white/10 bg-[var(--brand-navy-800)] px-5 pt-3"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => void request()}
              disabled={!canSend}
              className={`${primaryBtn} w-full gap-2 disabled:opacity-50`}
            >
              {phase === "sending" ? (
                <>
                  <Spinner />
                  Sending…
                </>
              ) : quote.capped ? (
                "Cap reached"
              ) : quote.canRequest ? (
                `Receive ${quote.amountNim.toLocaleString()} NIM`
              ) : (
                "Unavailable"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={phase === "sending"}
              className="mt-1 w-full py-2.5 text-sm font-semibold text-[var(--brand-muted)] transition hover:text-white disabled:opacity-50"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

