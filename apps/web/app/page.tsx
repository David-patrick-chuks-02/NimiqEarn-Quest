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
const IconHex = (p: IconProps) => (
  <S {...p}>
    <path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z" />
  </S>
);
const IconShield = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3 5 6v5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </S>
);
const IconBolt = (p: IconProps) => (
  <S {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </S>
);
const IconCompass = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </S>
);
const IconUpload = (p: IconProps) => (
  <S {...p}>
    <path d="M12 15V4m0 0 4 4m-4-4-4 4" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </S>
);
const IconCoins = (p: IconProps) => (
  <S {...p}>
    <ellipse cx="9" cy="7" rx="5.5" ry="2.5" />
    <path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" />
    <path d="M9.5 13.4c.6 2 3.2 3.1 6 3.1 3 0 5.5-1.1 5.5-2.5v-4c0-1.3-2.1-2.3-4.9-2.5" />
  </S>
);
const IconWallet = (p: IconProps) => (
  <S {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
    <path d="M3 7v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4H16a2 2 0 0 1 0-4h5V9a2 2 0 0 0-2-2" />
    <circle cx="16.5" cy="13" r="0.9" fill="currentColor" stroke="none" />
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

const FEATURES = [
  { icon: IconTelegram, label: "Telegram-native" },
  { icon: IconHex, label: "Built on Nimiq" },
  { icon: IconShield, label: "AI-assisted checks" },
  { icon: IconBolt, label: "Instant NIM rewards" },
];

const LOOP_STEPS = [
  { icon: IconCompass, label: "Discover", detail: "Browse paid quests inside Telegram." },
  { icon: IconUpload, label: "Submit proof", detail: "Send the proof a quest asks for." },
  { icon: IconShield, label: "Get verified", detail: "Deterministic + AI-assisted checks." },
  { icon: IconCoins, label: "Earn NIM", detail: "Rewards land in your Nimiq wallet." },
];

const HOW_IT_WORKS = [
  {
    icon: IconTelegram,
    title: "Start in Telegram",
    body: "Open the bot, send /start, and create your worker profile in seconds — no app install, no signup forms.",
  },
  {
    icon: IconWallet,
    title: "Link a Nimiq wallet",
    body: "Prove ownership by signing a message — no funds move. Validation and an audit trail keep payouts trackable.",
  },
  {
    icon: IconCoins,
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

/* ------------------------------- ui elements ------------------------------ */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-gold)]">
      {children}
    </span>
  );
}

/* ---------------------------------- page ---------------------------------- */

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-texture pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-20 text-center md:pt-28">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-[var(--brand-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-gold)]" />
            Telegram-native · powered by the Nimiq ecosystem
          </span>
          <h1 className="mx-auto mt-7 max-w-3xl text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-6xl">
            Complete tasks.
            <br className="hidden sm:block" /> Earn <span className="text-gradient-gold">NIM</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[var(--brand-muted)]">
            A task and bounty marketplace that lives entirely inside Telegram. Workers complete
            quests and get paid in NIM; creators run structured, paid campaigns.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button href={BOT_URL} icon>
              Start earning
            </Button>
            <Button href="#creators" variant="ghost">
              Publish a quest
            </Button>
          </div>

          {/* Feature pills */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2.5">
            {FEATURES.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-[var(--brand-muted)]"
              >
                <Icon className="h-3.5 w-3.5 text-[var(--brand-gold)]" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Reward loop */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LOOP_STEPS.map((s, i) => (
            <div
              key={s.label}
              className="group glass glass-hover relative rounded-2xl p-5"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-gold)]/12 text-[var(--brand-gold)]">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/25">
                  Step {i + 1}
                </span>
              </div>
              <div className="mt-3 text-[15px] font-semibold text-white">{s.label}</div>
              <div className="mt-1 text-sm leading-relaxed text-[var(--brand-muted)]">
                {s.detail}
              </div>
              {i < LOOP_STEPS.length - 1 && (
                <IconArrow className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-white/15 lg:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
              First message to first payout
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[var(--brand-muted)]">
              The whole loop happens in chat — no dashboards to learn.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map((item, i) => (
              <div
                key={item.title}
                className="glass glass-hover rounded-2xl p-7"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--brand-gold)]/20 bg-[var(--brand-gold)]/10 text-[var(--brand-gold)]">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-semibold text-white/30">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workers + Creators */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[
            {
              id: "workers",
              icon: IconUsers,
              title: "For workers",
              blurb:
                "Turn spare minutes into NIM. Pick up quests that fit you and get paid for genuine work.",
              points: WORKER_POINTS,
              cta: { label: "Start earning", variant: "primary" as const },
            },
            {
              id: "creators",
              icon: IconMegaphone,
              title: "For creators",
              blurb:
                "Activate your community with structured, paid campaigns — bounties, testing, feedback, and growth.",
              points: CREATOR_POINTS,
              cta: { label: "Open Creator Hub", variant: "ghost" as const },
            },
          ].map((card) => (
            <div
              key={card.id}
              id={card.id}
              className="glass glass-hover flex flex-col rounded-3xl p-8"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--brand-gold)]/20 bg-[var(--brand-gold)]/10 text-[var(--brand-gold)]">
                <card.icon className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-2xl font-bold text-white">{card.title}</h2>
              <p className="mt-2 text-[var(--brand-muted)]">{card.blurb}</p>
              <ul className="mt-6 space-y-3.5">
                {card.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-[var(--brand-text)]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]">
                      <IconCheck className="h-3 w-3" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-2">
                <Button href={BOT_URL} variant={card.cta.variant}>
                  {card.cta.label}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="px-6 pb-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-gradient-to-br from-[var(--brand-gold)] to-[#e0871a] px-6 py-16 text-center">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, #000 1px, transparent 1px), radial-gradient(circle at 70% 60%, #000 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--brand-ink)]">
              Ready to earn NIM in Telegram?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[var(--brand-ink)]/70">
              Open the app, create your profile, and complete your first quest.
            </p>
            <div className="mt-8">
              <Button href={BOT_URL} variant="dark" icon>
                Open {APP_NAME}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
