import type { Metadata } from "next";
import { APP_NAME } from "@nimiqearn/shared";
import { BOT_URL, Button, CONTACT_EMAIL, SiteFooter, SiteHeader } from "../_components/chrome";

export const metadata: Metadata = {
  title: "About — NimiqEarn Quest",
  description:
    "NimiqEarn Quest turns Telegram into a practical earning channel for the Nimiq ecosystem.",
};

const ROADMAP = [
  {
    tag: "Milestone 1",
    title: "Core MVP infrastructure",
    body: "Telegram bot foundation, wallet onboarding with real ownership verification, and basic quest creation.",
    status: "In progress",
  },
  {
    tag: "Milestone 2",
    title: "Marketplace & payments",
    body: "Quest discovery and submission, plus the NIM payout engine and deterministic verification.",
    status: "Upcoming",
  },
  {
    tag: "Milestone 3",
    title: "Verification & launch",
    body: "AI-assisted moderation, reputation and anti-spam controls, and public beta launch.",
    status: "Upcoming",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-gold)]">
          About
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
          Making NIM useful, one quest at a time
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[var(--brand-muted)]">
          {APP_NAME} turns Telegram into a lightweight earning and participation channel for the
          Nimiq ecosystem. Workers complete quests and get paid in NIM; communities, startups, and
          creators run structured, paid campaigns — all inside a chat.
        </p>

        <div className="prose-legal mt-12">
          <h2>Why we&apos;re building it</h2>
          <p>
            Getting started with crypto earning is often too complex, too slow to pay out, or too
            dependent on banking rails — especially for mobile-first users in emerging markets. At
            the same time, Web3 projects and communities lack simple tools to activate contributors
            and run bounty programs.
          </p>
          <p>
            {APP_NAME} closes both gaps with one mobile-first loop:{" "}
            <strong>discover tasks → submit proof → get verified → receive NIM</strong>. The goal is
            real, recurring utility for NIM and a practical incentive layer for communities.
          </p>

          <h2>Built on Nimiq</h2>
          <p>
            Wallet onboarding uses Nimiq&apos;s own tooling, and ownership is proven by signing a
            message — never by sharing keys. The platform is non-custodial: we store only your public
            address, and rewards are paid on the Nimiq network.
          </p>
        </div>

        {/* Roadmap */}
        <h2 className="mt-14 text-xl font-bold tracking-tight text-white">Roadmap</h2>
        <div className="mt-6 space-y-3">
          {ROADMAP.map((m) => (
            <div
              key={m.tag}
              className="glass glass-hover rounded-2xl p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
                  {m.tag}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    m.status === "In progress"
                      ? "bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]"
                      : "bg-white/5 text-white/45"
                  }`}
                >
                  {m.status}
                </span>
              </div>
              <h3 className="mt-2 text-[15px] font-semibold text-white">{m.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--brand-muted)]">{m.body}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="glass mt-14 flex flex-col items-center gap-4 rounded-3xl p-8 text-center">
          <p className="text-white">Ready to try it?</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button href={BOT_URL} icon>
              Open the app
            </Button>
            {CONTACT_EMAIL && (
              <Button href={`mailto:${CONTACT_EMAIL}`} variant="ghost">
                Contact us
              </Button>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
