import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@nimiqearn/shared";

export const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "https://t.me/YourBot";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
export const GITHUB_URL = "https://github.com/David-patrick-chuks-02/NimiqEarn-Quest";

export function IconArrow({ className }: { className?: string }) {
  return (
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
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export function Button({
  href,
  children,
  variant = "primary",
  icon,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "dark";
  icon?: boolean;
}) {
  const base =
    "group inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200";
  const styles = {
    primary: "bg-[var(--brand-gold)] text-[var(--brand-ink)] hover:bg-[var(--brand-gold-600)]",
    ghost: "border border-white/12 text-white hover:border-white/25 hover:bg-white/5",
    dark: "bg-[var(--brand-ink)] text-[var(--brand-gold)] hover:bg-[var(--brand-navy-700)]",
  }[variant];
  return (
    <a href={href} className={`${base} ${styles}`}>
      {children}
      {icon && <IconArrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
    </a>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image
        src="/logo.png"
        alt="NimiqEarn Quest logo"
        width={size}
        height={Math.round((size * 284) / 265)}
        sizes={`${size}px`}
        className="rounded-lg"
      />
      <span className="text-[15px] font-bold tracking-tight">
        Nimiq<span className="text-[var(--brand-gold)]">Earn</span> Quest
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[var(--brand-navy-900)]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-9 text-sm text-[var(--brand-muted)] md:flex">
          <a href="/#how" className="transition-colors hover:text-white">
            How it works
          </a>
          <a href="/#workers" className="transition-colors hover:text-white">
            Workers
          </a>
          <a href="/#creators" className="transition-colors hover:text-white">
            Creators
          </a>
          <Link href="/faq" className="transition-colors hover:text-white">
            FAQ
          </Link>
        </nav>
        <Button href={BOT_URL}>Open App</Button>
      </div>
    </header>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-white/40">{title}</div>
      <ul className="mt-4 space-y-2.5 text-sm text-[var(--brand-muted)]">{children}</ul>
    </div>
  );
}

const footerLink = "transition-colors hover:text-white";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="col-span-2 max-w-xs md:col-span-1">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-[var(--brand-muted)]">
              A Telegram-native task and bounty marketplace for the Nimiq ecosystem.
            </p>
          </div>

          <FooterCol title="Product">
            <li>
              <a href={BOT_URL} className={footerLink}>
                Open App
              </a>
            </li>
            <li>
              <a href="/#how" className={footerLink}>
                How it works
              </a>
            </li>
            <li>
              <a href="/#workers" className={footerLink}>
                For workers
              </a>
            </li>
            <li>
              <a href="/#creators" className={footerLink}>
                For creators
              </a>
            </li>
          </FooterCol>

          <FooterCol title="Legal">
            <li>
              <Link href="/privacy" className={footerLink}>
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className={footerLink}>
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/faq" className={footerLink}>
                FAQ
              </Link>
            </li>
          </FooterCol>

          <FooterCol title="Resources">
            <li>
              <Link href="/about" className={footerLink}>
                About
              </Link>
            </li>
            <li>
              <Link href="/feedback" className={footerLink}>
                Feedback
              </Link>
            </li>
            <li>
              <a href="https://www.nimiq.com" target="_blank" rel="noreferrer" className={footerLink}>
                Nimiq
              </a>
            </li>
            <li>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={footerLink}>
                GitHub
              </a>
            </li>
            {CONTACT_EMAIL && (
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className={footerLink}>
                  Contact
                </a>
              </li>
            )}
          </FooterCol>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/[0.06] pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <span>© {APP_NAME} · Built for the Nimiq ecosystem</span>
          <span>NIM rewards depend on completing and passing verification. Not financial advice.</span>
        </div>
      </div>
    </footer>
  );
}
