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
    async (page = 0) => {
      const body = (await api(`/api/quests?page=${page}&pageSize=${PAGE_SIZE}`)) as unknown as DiscoverPage;
      setData(body);
    },
    [api],
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
          <div className="space-y-2.5">
            {data.quests.length === 0 ? (
              <Info>No open quests right now. Check back soon.</Info>
            ) : (
              data.quests.map((q) => (
                <Link
                  key={q.id}
                  href={`/quest/${q.id}`}
                  className="glass block rounded-xl p-4 transition hover:border-[var(--brand-gold)]/40"
                >
                  <p className="truncate text-sm font-semibold text-white">{q.title}</p>
                  <p className="mt-1 text-xs text-[var(--brand-muted)]">
                    {Number(q.rewardAmount).toLocaleString()} NIM · {q.slotsLeft} of {q.totalSlots} left
                  </p>
                </Link>
              ))
            )}
          </div>
        )}
      </main>
    </>
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
