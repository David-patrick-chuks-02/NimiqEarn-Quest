"use client";

import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "loading" | "no-telegram" | "ready" | "error";

interface DiscoverQuest {
  id: string;
  title: string;
  category: string;
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
  slotsLeft: number;
  promoted: boolean;
  proofType: string;
  viewCount: number;
  creatorName: string | null;
}

interface DiscoverPage {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  quests: DiscoverQuest[];
}

const PAGE_SIZE = 10;

export default function EarnPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<DiscoverPage | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const initDataRef = useRef<string>("");

  const api = useCallback(async (path: string) => {
    const headers: Record<string, string> = { "x-telegram-init-data": initDataRef.current };
    // The API can cold-start; retry idempotent GETs on gateway errors before surfacing.
    for (let attempt = 0; attempt < 4; attempt++) {
      let res: Response;
      try {
        res = await fetch(path, { headers });
      } catch (e) {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        throw e;
      }
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error((body.error as string) ?? `Request failed (${res.status})`);
      return body;
    }
    throw new Error("The server is waking up. Please try again in a moment.");
  }, []);

  const load = useCallback(
    async (page = 0, cat: string | null = null) => {
      const q = `page=${page}&pageSize=${PAGE_SIZE}${cat ? `&category=${cat}` : ""}`;
      const body = (await api(`/api/quests?${q}`)) as unknown as DiscoverPage;
      setData(body);
    },
    [api],
  );

  // Re-query on filter/page change (used by the chips + pagination once ready).
  const refresh = useCallback(
    async (page: number, cat: string | null) => {
      setBusy(true);
      setError("");
      try {
        await load(page, cat);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const boot = useCallback(async () => {
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData ?? "";
    if (!initData) {
      setPhase("no-telegram");
      return;
    }
    initDataRef.current = initData;
    try {
      tg?.ready();
      tg?.expand();
      tg?.setHeaderColor?.("#070c17");
      tg?.setBackgroundColor?.("#070c17");
    } catch {
      // Older Telegram clients may not support every method — non-fatal.
    }
    try {
      await load(0);
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [load]);

  useEffect(() => {
    if (window.Telegram?.WebApp) void boot();
  }, [boot]);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={() => void boot()}
      />
      <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6">
        <header className="mb-5 flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={26} height={28} className="rounded-md" />
          <span className="text-sm font-bold tracking-tight">
            Nimiq<span className="text-[var(--brand-gold)]">Earn</span> Quest
          </span>
        </header>

        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white">Browse quests</h1>
          <p className="mt-1 text-sm text-[var(--brand-muted)]">
            Complete a quest and earn NIM, paid straight to your wallet.
          </p>
        </div>

        {phase === "loading" && <p className="text-sm text-[var(--brand-muted)]">Loading…</p>}

        {phase === "no-telegram" && (
          <Info>Open this from the NimiqEarn Quest bot in Telegram to browse quests.</Info>
        )}

        {phase === "error" && (
          <Info tone="error">
            {error || "Something went wrong."}
            <button
              onClick={() => void boot()}
              className="mt-4 rounded-full bg-[var(--brand-gold)] px-5 py-2 text-sm font-semibold text-[var(--brand-ink)]"
            >
              Try again
            </button>
          </Info>
        )}

        {phase === "ready" && data && (
          <div className="space-y-3">
            {/* Category filter chips */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {[{ value: null, label: "All" }, ...CATEGORY_CHIPS].map((c) => {
                const on = category === c.value;
                return (
                  <button
                    key={c.label}
                    disabled={busy}
                    onClick={() => {
                      setCategory(c.value);
                      void refresh(0, c.value);
                    }}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${
                      on
                        ? "bg-[var(--brand-gold)] text-[var(--brand-ink)]"
                        : "glass text-white hover:border-white/25"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {data.quests.length === 0 ? (
              <Info>No open quests match. Try another category or check back soon.</Info>
            ) : (
              <div className="space-y-2.5">
                {data.quests.map((q) => (
                  <QuestCard key={q.id} quest={q} />
                ))}
              </div>
            )}

            {data.pageCount > 1 && (
              <div className="flex items-center justify-between pt-1">
                <button
                  disabled={busy || data.page === 0}
                  onClick={() => void refresh(data.page - 1, category)}
                  className="rounded-full border border-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-sm text-[var(--brand-muted)]">
                  Page {data.page + 1} of {data.pageCount}
                </span>
                <button
                  disabled={busy || data.page >= data.pageCount - 1}
                  onClick={() => void refresh(data.page + 1, category)}
                  className="rounded-full border border-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  PRODUCT_TESTING: "Product testing",
  SOCIAL_CAMPAIGN: "Social campaign",
  COMMUNITY_ENGAGEMENT: "Community engagement",
  REFERRAL: "Referral",
  CONTENT: "Content",
  FEEDBACK: "Feedback",
  BUG_BOUNTY: "Bug bounty",
  OTHER: "Quest",
};

const CATEGORY_CHIPS: { value: string; label: string }[] = [
  { value: "SOCIAL_CAMPAIGN", label: "Social" },
  { value: "PRODUCT_TESTING", label: "Testing" },
  { value: "CONTENT", label: "Content" },
  { value: "COMMUNITY_ENGAGEMENT", label: "Community" },
  { value: "REFERRAL", label: "Referral" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "BUG_BOUNTY", label: "Bounty" },
  { value: "OTHER", label: "Other" },
];

function QuestCard({ quest }: { quest: DiscoverQuest }) {
  return (
    <Link
      href={`/quest/${quest.id}`}
      className={`glass block overflow-hidden rounded-xl transition hover:border-[var(--brand-gold)]/40 ${
        quest.promoted ? "border-[var(--brand-gold)]/40" : ""
      }`}
    >
      {/* The shareable OG card as a preview (non-counting). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/q/${quest.id}/opengraph-image`}
        alt=""
        loading="lazy"
        className="aspect-[1200/630] w-full border-b border-white/10 object-cover"
      />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-white">{quest.title}</p>
          {quest.promoted && (
            <span className="shrink-0 rounded-full bg-[var(--brand-gold)]/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[var(--brand-gold)]">
              Promoted
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--brand-muted)]">
          {CATEGORY_LABELS[quest.category] ?? "Quest"}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-base font-bold text-[var(--brand-gold)]">
            {Number(quest.rewardAmount).toLocaleString()} NIM
          </span>
          <span className="text-xs text-[var(--brand-muted)]">
            {quest.slotsLeft} of {quest.totalSlots} left
          </span>
        </div>
      </div>
    </Link>
  );
}

function Info({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div
      className={`glass rounded-2xl p-5 text-center text-sm ${
        tone === "error" ? "text-red-400" : "text-[var(--brand-muted)]"
      }`}
    >
      {children}
    </div>
  );
}

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: string;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
