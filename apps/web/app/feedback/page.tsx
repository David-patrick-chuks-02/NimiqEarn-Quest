import type { Metadata } from "next";
import { BOT_URL, Button, IconArrow, SiteFooter, SiteHeader } from "../_components/chrome";
import { FeedbackForm } from "./FeedbackForm";

export const metadata: Metadata = {
  title: "Feedback — NimiqEarn Quest",
  description:
    "Try @NimiqEarnBot, then leave anonymous feedback on what worked and what didn't.",
  openGraph: {
    title: "Share feedback on NimiqEarn Quest",
    description:
      "Try @NimiqEarnBot, then tell us what worked and what didn't. Name optional — stay anonymous.",
    type: "website",
    url: "https://www.nimiqearn.com/feedback",
  },
  twitter: {
    card: "summary_large_image",
    title: "Share feedback on NimiqEarn Quest",
    description:
      "Try @NimiqEarnBot, then tell us what worked and what didn't. Name optional — stay anonymous.",
  },
};

const STEPS = ["Open @NimiqEarnBot", "Try the flows", "Tell us what to fix"];

export default function FeedbackPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <p className="eyebrow">Product feedback</p>
        <h1 className="mt-4 text-3xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl">
          Help us sharpen{" "}
          <span className="text-gradient-gold">NimiqEarn Quest</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--brand-muted)]">
          Spend a few minutes in Telegram, then leave a short note on what worked and what
          didn&apos;t. Name and handle are optional — blank means anonymous.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button href={BOT_URL} icon>
            Open @NimiqEarnBot
          </Button>
          <Button href="#feedback-form" variant="ghost">
            Leave feedback
          </Button>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-2 text-[var(--brand-muted)]">
          {STEPS.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="eyebrow !text-[11px] text-[var(--brand-text)]">{step}</span>
              {i < STEPS.length - 1 && <IconArrow className="h-3.5 w-3.5 text-white/25" />}
            </span>
          ))}
        </div>

        <div id="feedback-form" className="scroll-mt-28">
          <FeedbackForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
