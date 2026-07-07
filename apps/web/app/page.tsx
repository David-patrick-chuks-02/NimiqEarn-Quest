import { APP_NAME } from "@nimiqearn/shared";
import { BOT_URL, Button, IconArrow, SiteFooter, SiteHeader } from "./_components/chrome";

/* ---------------------------------- icons --------------------------------- */

type IconProps = { className?: string };
const S = ({ className, children }: IconProps & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

const IconTelegram = (p: IconProps) => (
  <S {...p}>
    <path d="M21.5 4.5 2.9 11.3c-1 .4-1 1.8.1 2.1l4.6 1.4 1.7 5.2c.3.9 1.4 1 1.9.3l2.5-3 4.7 3.5c.6.4 1.5.1 1.7-.7l3-14c.2-1-.7-1.8-1.6-1.4Z" />
    <path d="m8 14.5 9-6.5-6.5 7v3.5" />
  </S>
);
const IconWallet = (p: IconProps) => (
  <S {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
    <path d="M3 7v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4H16a2 2 0 0 1 0-4h5V9a2 2 0 0 0-2-2" />
    <circle cx="16.5" cy="13" r="0.9" fill="currentColor" stroke="none" />
  </S>
);
const IconCoins = (p: IconProps) => (
  <S {...p}>
    <ellipse cx="9" cy="7" rx="5.5" ry="2.5" />
    <path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" />
    <path d="M9.5 13.4c.6 2 3.2 3.1 6 3.1 3 0 5.5-1.1 5.5-2.5v-4c0-1.3-2.1-2.3-4.9-2.5" />
  </S>
);
const IconUsers = (p: IconProps) => (
  <S {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 20a5.5 5.5 0 0 0-3-4.9" />
  </S>
);
const IconMegaphone = (p: IconProps) => (
  <S {...p}>
    <path d="M4 9v4a1 1 0 0 0 1 1h2l7 4V4L7 8H5a1 1 0 0 0-1 1Z" />
    <path d="M18 8a4 4 0 0 1 0 8" />
  </S>
);
const IconCheck = (p: IconProps) => (
  <S {...p}>
    <path d="m5 12.5 4 4 10-10" />
  </S>
);

/* --------------------------------- content -------------------------------- */

const LOOP = ["Discover", "Submit proof", "Verify", "Earn NIM"];

const FEATURES = ["Telegram-native", "Built on Nimiq", "AI-assisted checks", "Instant NIM payouts"];

const HOW = [
  {
    icon: IconTelegram,
    title: "Start in Telegram",
    body: "Send /start and create a worker profile in seconds — no app install, no signup forms.",
  },
  {
    icon: IconWallet,
    title: "Link a Nimiq wallet",
    body: "Prove ownership by signing a message. No funds move; the address is read from your signature.",
  },
  {
    icon: IconCoins,
    title: "Complete quests & earn",
    body: "Submit the required proof, pass verification, and receive NIM to your wallet.",
  },
];

const WORKER_POINTS = [
  "Everything runs inside Telegram — mobile-first",
  "Testing, feedback, social, referrals, bug bounties",
  "Fast NIM payouts, no banking dependencies",
  "Reputation that smooths approvals over time",
];

const CREATOR_POINTS = [
  "Publish bounties with rewards, slots, deadlines",
  "Define exactly what proof workers submit",
  "Draft, review, and publish from Telegram",
  "Reach a community of motivated contributors",
];

/* ---------------------------------- page ---------------------------------- */

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-16 pt-20 text-center lg:pt-28">
        <p className="eyebrow">Telegram-native · powered by Nimiq</p>
        <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
          Complete tasks.
          <br />
          Earn <span className="text-gradient-gold">NIM</span>.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--brand-muted)]">
          A task and bounty marketplace that lives entirely inside Telegram. Workers complete quests
          and get paid in NIM; creators run structured, paid campaigns.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button href={BOT_URL} icon>
            Start earning
          </Button>
          <Button href="#creators" variant="ghost">
            Publish a quest
          </Button>
        </div>

        {/* Reward loop — slim mono stepper */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[var(--brand-muted)]">
          {LOOP.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="eyebrow !text-[11px] text-[var(--brand-text)]">{step}</span>
              {i < LOOP.length - 1 && <IconArrow className="h-3.5 w-3.5 text-white/25" />}
            </span>
          ))}
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-y border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-5 sm:justify-between">
          {FEATURES.map((f) => (
            <span key={f} className="flex items-center gap-2 text-sm text-[var(--brand-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-gold)]" />
              {f}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-3 max-w-lg text-3xl font-bold tracking-tight text-white">
          First message to first payout
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {HOW.map((item, i) => (
            <div key={item.title} className="glass glass-hover rounded-2xl p-7">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--brand-gold)]/25 bg-[var(--brand-gold)]/10 text-[var(--brand-gold)]">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="eyebrow">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workers + Creators */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[
            {
              id: "workers",
              icon: IconUsers,
              title: "For workers",
              blurb: "Turn spare minutes into NIM. Pick up quests that fit you and get paid for real work.",
              points: WORKER_POINTS,
              cta: { label: "Start earning", variant: "primary" as const },
            },
            {
              id: "creators",
              icon: IconMegaphone,
              title: "For creators",
              blurb: "Activate your community with structured, paid campaigns — bounties, testing, growth.",
              points: CREATOR_POINTS,
              cta: { label: "Open Creator Hub", variant: "ghost" as const },
            },
          ].map((card) => (
            <div key={card.id} id={card.id} className="glass flex flex-col rounded-2xl p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[var(--brand-gold)]">
                <card.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-5 text-2xl font-bold text-white">{card.title}</h2>
              <p className="mt-2 text-[var(--brand-muted)]">{card.blurb}</p>
              <ul className="mt-6 space-y-3">
                {card.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-[var(--brand-text)]">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-gold)]" />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button href={BOT_URL} variant={card.cta.variant}>
                  {card.cta.label}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20">
        <div className="glass mx-auto flex max-w-6xl flex-col items-center gap-5 rounded-3xl px-6 py-16 text-center">
          <p className="eyebrow">Get started</p>
          <h2 className="max-w-xl text-3xl font-bold tracking-tight text-white">
            Ready to earn NIM in Telegram?
          </h2>
          <p className="max-w-md text-[var(--brand-muted)]">
            Open the app, create your profile, and complete your first quest.
          </p>
          <div className="mt-2">
            <Button href={BOT_URL} icon>
              Open {APP_NAME}
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
