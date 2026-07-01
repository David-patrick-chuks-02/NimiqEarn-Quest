import Image from "next/image";
import { APP_NAME } from "@nimiqearn/shared";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "https://t.me/YourBot";

const FEATURES = [
  "Telegram powered",
  "Built on Nimiq",
  "AI-powered verification",
  "Instant NIM rewards",
];

const LOOP_STEPS = [
  { label: "Discover", detail: "Browse paid quests inside Telegram." },
  { label: "Submit proof", detail: "Send the proof a quest asks for." },
  { label: "Get verified", detail: "Deterministic + AI-assisted checks." },
  { label: "Earn NIM", detail: "Rewards land in your Nimiq wallet." },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Start in Telegram",
    body: "Open NimiqEarn Quest in Telegram, send /start, and create your worker profile in seconds — no app install, no signup forms.",
  },
  {
    step: "2",
    title: "Link a Nimiq wallet",
    body: "Add your NIM payout address. Validation and an audit trail keep payouts transparent and trackable.",
  },
  {
    step: "3",
    title: "Complete quests & earn",
    body: "Pick quests, submit the required proof, and get paid in NIM once your submission is verified.",
  },
];

const WORKER_POINTS = [
  "Mobile-first — everything runs inside Telegram",
  "Simple tasks: testing, feedback, social, referrals, bug bounties",
  "Fast NIM payouts, no banking dependencies",
  "Reputation that unlocks smoother approvals over time",
];

const CREATOR_POINTS = [
  "Publish bounties with rewards, slots, and deadlines",
  "Define exactly what proof workers must submit",
  "Draft, review, and publish quests from Telegram",
  "Reach a community of motivated contributors",
];

function CtaButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "dark";
}) {
  const base =
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors";
  const styles = {
    primary: "bg-[var(--brand-gold)] text-[var(--brand-ink)] hover:bg-[var(--brand-gold-600)]",
    ghost: "border border-white/25 text-white hover:bg-white/10",
    dark: "bg-[var(--brand-ink)] text-[var(--brand-gold)] hover:bg-[var(--brand-navy-700)]",
  }[variant];
  return (
    <a href={href} className={`${base} ${styles}`}>
      {children}
    </a>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <Image
        src="/logo.png"
        alt="NimiqEarn Quest logo"
        width={36}
        height={39}
        className="rounded-lg"
        priority
      />
      <span className="text-lg font-bold tracking-tight">
        Nimiq<span className="text-[var(--brand-gold)]">Earn</span> Quest
      </span>
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-[var(--brand-muted)] md:flex">
          <a href="#how" className="hover:text-white">
            How it works
          </a>
          <a href="#workers" className="hover:text-white">
            Workers
          </a>
          <a href="#creators" className="hover:text-white">
            Creators
          </a>
        </nav>
        <CtaButton href={BOT_URL}>Open App</CtaButton>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 text-center md:pt-16">
        <Image
          src="/logo.png"
          alt="NimiqEarn Quest logo"
          width={96}
          height={103}
          className="mx-auto mb-8 rounded-2xl shadow-lg shadow-black/30"
          priority
        />
        <span className="inline-block rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs font-medium text-[var(--brand-muted)]">
          Telegram-native · powered by the Nimiq ecosystem
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white md:text-6xl">
          Complete tasks. Earn{" "}
          <span className="text-[var(--brand-gold)]">NIM</span>. Empower
          communities.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--brand-muted)]">
          {APP_NAME} is a task and bounty marketplace that lives entirely inside
          Telegram. Workers complete quests and get paid in NIM; creators run
          structured, paid campaigns for the Nimiq community.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <CtaButton href={BOT_URL}>Start earning</CtaButton>
          <CtaButton href="#creators" variant="ghost">
            Publish a quest
          </CtaButton>
        </div>

        {/* Feature chips (from the banner) */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
          {FEATURES.map((feature) => (
            <span key={feature} className="flex items-center gap-2">
              <span className="text-[var(--brand-gold)]">◆</span>
              {feature}
            </span>
          ))}
        </div>

        {/* Reward loop */}
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LOOP_STEPS.map((s, i) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-sm"
            >
              <div className="text-xs font-semibold text-[var(--brand-gold)]">
                Step {i + 1}
              </div>
              <div className="mt-1 text-base font-bold text-white">{s.label}</div>
              <div className="mt-1 text-sm text-[var(--brand-muted)]">{s.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-white/10 bg-[var(--brand-navy-800)]/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[var(--brand-muted)]">
            From first message to first payout — the whole loop happens in chat.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-gold)] text-sm font-bold text-[var(--brand-ink)]">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-[var(--brand-muted)]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workers + Creators */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div
            id="workers"
            className="rounded-3xl border border-white/10 bg-white/5 p-8"
          >
            <h2 className="text-2xl font-bold text-white">For workers</h2>
            <p className="mt-2 text-[var(--brand-muted)]">
              Turn spare minutes into NIM. Pick up quests that fit you and get
              paid for genuine work.
            </p>
            <ul className="mt-6 space-y-3">
              {WORKER_POINTS.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-sm text-[var(--brand-text)]"
                >
                  <span className="mt-0.5 text-[var(--brand-gold)]">✓</span>
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <CtaButton href={BOT_URL}>Start earning</CtaButton>
            </div>
          </div>

          <div
            id="creators"
            className="rounded-3xl border border-white/10 bg-white/5 p-8"
          >
            <h2 className="text-2xl font-bold text-white">For creators</h2>
            <p className="mt-2 text-[var(--brand-muted)]">
              Activate your community with structured, paid campaigns — bounties,
              testing, feedback, and growth tasks.
            </p>
            <ul className="mt-6 space-y-3">
              {CREATOR_POINTS.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-sm text-[var(--brand-text)]"
                >
                  <span className="mt-0.5 text-[var(--brand-gold)]">✓</span>
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <CtaButton href={BOT_URL} variant="ghost">
                Open Creator Hub
              </CtaButton>
            </div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl rounded-3xl bg-[var(--brand-gold)] px-6 py-16 text-center">
          <h2 className="text-3xl font-bold text-[var(--brand-ink)]">
            Ready to earn NIM in Telegram?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[var(--brand-ink)]/80">
            Open NimiqEarn Quest in Telegram, create your profile, and complete your first quest.
          </p>
          <div className="mt-8">
            <CtaButton href={BOT_URL} variant="dark">
              Open {APP_NAME}
            </CtaButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-[var(--brand-muted)] md:flex-row">
          <span>© {APP_NAME} · Built for the Nimiq ecosystem</span>
          <nav className="flex items-center gap-6">
            <a href={BOT_URL} className="hover:text-white">
              Open App
            </a>
            <a
              href="https://www.nimiq.com"
              className="hover:text-white"
              target="_blank"
              rel="noreferrer"
            >
              Nimiq
            </a>
            <a
              href="https://github.com/David-patrick-chuks/NimiqEarn-Quest"
              className="hover:text-white"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
