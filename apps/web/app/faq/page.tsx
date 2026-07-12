import type { Metadata } from "next";
import { BOT_URL, Button, SiteFooter, SiteHeader } from "../_components/chrome";

export const metadata: Metadata = {
  title: "FAQ — NimiqEarn Quest",
  description: "Answers to common questions about earning NIM with NimiqEarn Quest.",
};

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is NimiqEarn Quest?",
    a: "A Telegram-native task and bounty marketplace for the Nimiq ecosystem. Creators publish paid quests; workers complete them, submit proof, and earn NIM once verified.",
  },
  {
    q: "How do I get started?",
    a: "Open the Telegram bot and send /start. You'll create a profile in seconds — no app install and no signup forms.",
  },
  {
    q: "Is it free to join?",
    a: "Yes. Joining and completing quests is free — workers earn NIM for approved submissions.",
  },
  {
    q: "Do you hold my funds or private keys?",
    a: "No. NimiqEarn Quest is non-custodial. We only ever store your public Nimiq address. We never see your private keys or seed phrase and never take custody of your funds.",
  },
  {
    q: "How do I link a wallet?",
    a: "Open My Wallet in the bot and follow the signing link. You sign a short message with the wallet you want to link — no funds move — and we read the address from your signature. There's nothing to copy or paste.",
  },
  {
    q: "Can I link more than one wallet?",
    a: "Yes. You can link multiple wallets and choose one as your primary payout wallet. You can switch the primary or unlink any wallet at any time. Each address can only be linked to one account.",
  },
  {
    q: "How does verification work?",
    a: "Submissions run through deterministic rule checks first, then AI-assisted moderation. High-confidence submissions can auto-approve, while borderline or suspicious ones go to review. This keeps rewards fair and reduces spam and fraud.",
  },
  {
    q: "How and when do I get paid?",
    a: "Rewards are paid in NIM to your primary wallet after a submission passes verification. The automated payout engine ships in a later milestone as the project rolls out.",
  },
  {
    q: "How do I become a creator?",
    a: "Open the Creator Hub in the bot and register as a creator. You can then create quests with a reward, slots, an optional scheduled start, and the exact proof you require, and publish them.",
  },
  {
    q: "Is my data safe?",
    a: (
      <>
        We store the minimum needed to run the service and never sell your data. See our{" "}
        <a href="/privacy" className="text-[var(--brand-gold)] underline underline-offset-2">
          Privacy Policy
        </a>{" "}
        for details.
      </>
    ),
  },
  {
    q: "What's the current status of the project?",
    a: (
      <>
        NimiqEarn Quest is in active, milestone-based development, and all work is public on{" "}
        <a
          href="https://github.com/David-patrick-chuks/NimiqEarn-Quest"
          className="text-[var(--brand-gold)] underline underline-offset-2"
        >
          GitHub
        </a>
        .
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-gold)]">
          Help
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Frequently asked questions
        </h1>
        <p className="mt-3 text-[var(--brand-muted)]">
          Everything you need to know about earning NIM with NimiqEarn Quest.
        </p>

        <div className="mt-10 space-y-3">
          {FAQS.map((item) => (
            <div
              key={item.q}
              className="glass glass-hover rounded-2xl p-6"
            >
              <h2 className="text-[15px] font-semibold text-white">{item.q}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">{item.a}</p>
            </div>
          ))}
        </div>

        <div className="glass mt-12 flex flex-col items-center gap-4 rounded-3xl p-8 text-center">
          <p className="text-white">Still have a question?</p>
          <Button href={BOT_URL} icon>
            Open the app
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
