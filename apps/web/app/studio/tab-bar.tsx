"use client";

import type { TabKey } from "./types";
import { TABS } from "./constants";

/* --------------------------------- tab bar -------------------------------- */

const TAB_ICON: Record<TabKey, React.ReactNode> = {
  home: (
    <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />
  ),
  create: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  quests: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16 12h.01M3 9h18" />
    </>
  ),
};


// Fixed bottom navigation — the single surface for the whole Creator Studio Mini App.
// Fixed bottom navigation — the single surface for the whole Creator Studio Mini App.
export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[var(--brand-navy-900)]/95 pb-3 backdrop-blur"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium transition ${
                isActive ? "text-[var(--brand-gold)]" : "text-[var(--brand-muted)] hover:text-white"
              }`}
            >
              <span
                className={`absolute inset-x-5 top-0 h-0.5 rounded-full bg-[var(--brand-gold)] transition-opacity ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                {TAB_ICON[t.key]}
              </svg>
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

