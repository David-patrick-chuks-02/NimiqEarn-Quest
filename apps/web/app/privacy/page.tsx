import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../_components/chrome";

export const metadata: Metadata = {
  title: "Privacy Policy — NimiqEarn Quest",
  description: "How NimiqEarn Quest collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-gold)]">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[var(--brand-muted)]">Last updated: July 4, 2026</p>

        <div className="prose-legal mt-10">
          <p>
            This Privacy Policy explains what information NimiqEarn Quest (&ldquo;we&rdquo;,
            &ldquo;us&rdquo;) collects when you use our Telegram bot and website, how we use it, and
            the choices you have. By using the service, you agree to this policy.
          </p>

          <h2>Information we collect</h2>
          <ul>
            <li>
              <strong>Telegram profile.</strong> When you use the bot, we receive your Telegram user
              ID and, if available, your username and display name.
            </li>
            <li>
              <strong>Wallet information.</strong> We create a custodial Nimiq wallet for your
              account and store the private key encrypted at rest. We also store the public address,
              balance-related activity needed to operate payouts, and an audit log of address
              changes. You may export your private key using your security password.
            </li>
            <li>
              <strong>Activity.</strong> Quests you create or complete, submissions and their
              verification status, reputation, and similar records as features roll out.
            </li>
            <li>
              <strong>Technical data.</strong> Session state (temporarily cached), rate-limit
              counters, and standard server logs used to operate and secure the service.
            </li>
          </ul>

          <h2>How we use information</h2>
          <ul>
            <li>Operate the bot and marketplace and provide the features you request.</li>
            <li>Verify wallet ownership and deliver NIM rewards to your linked address.</li>
            <li>Prevent fraud, spam, multi-accounting, and other abuse.</li>
            <li>Maintain transparent, auditable payout records.</li>
            <li>Improve reliability, performance, and product quality.</li>
          </ul>

          <h2>How information is shared</h2>
          <p>
            We do not sell your personal data. We share information only with the infrastructure
            providers that run the service (for example, our database/hosting and Telegram as the
            messaging platform), and where required by law. Note that Nimiq addresses and
            transactions are <strong>public on the Nimiq blockchain</strong> by design.
          </p>

          <h2>Storage and security</h2>
          <p>
            Data is stored in a managed PostgreSQL database with access controls, secrets held in
            environment configuration, and input validation across the service. No system is
            perfectly secure, but we take reasonable measures to protect your information.
          </p>

          <h2>Data retention</h2>
          <p>
            We keep your data while your account is active and as needed to operate the service,
            meet legal obligations, and prevent abuse. You can request deletion of your profile and
            linked wallets at any time.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>Access, correct, or delete your profile data.</li>
            <li>Unlink any wallet, or switch your primary payout wallet, from the bot.</li>
            <li>Stop using the bot at any time.</li>
          </ul>

          <h2>Children</h2>
          <p>
            The service is not intended for anyone under 18 (or the age of majority in your
            jurisdiction). Do not use it if you are below that age.
          </p>

          <h2>International processing</h2>
          <p>
            Your information may be processed in countries other than your own, which may have
            different data-protection rules.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Material changes will be reflected here with
            a new &ldquo;last updated&rdquo; date.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about privacy? Reach us through the Telegram bot or via our{" "}
            <a href="https://github.com/David-patrick-chuks/NimiqEarn-Quest">GitHub repository</a>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
