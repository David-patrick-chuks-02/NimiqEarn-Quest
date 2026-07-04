import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../_components/chrome";

export const metadata: Metadata = {
  title: "Terms of Service — NimiqEarn Quest",
  description: "The terms that govern your use of NimiqEarn Quest.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-gold)]">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Terms of Service</h1>
        <p className="mt-2 text-sm text-[var(--brand-muted)]">Last updated: July 4, 2026</p>

        <div className="prose-legal mt-10">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the NimiqEarn Quest
            Telegram bot and website (the &ldquo;Service&rdquo;). By using the Service, you agree to
            these Terms. If you do not agree, do not use the Service.
          </p>

          <h2>1. Eligibility</h2>
          <p>
            You must be at least 18 years old (or the age of majority in your jurisdiction), legally
            able to enter into these Terms, and not barred from using the Service under any
            applicable law or sanctions.
          </p>

          <h2>2. What the Service is</h2>
          <p>
            NimiqEarn Quest is a Telegram-native marketplace where creators publish quests and
            workers complete them to earn NIM rewards, subject to verification. Features are released
            in milestones and may change over time.
          </p>

          <h2>3. Wallets and funds</h2>
          <ul>
            <li>
              You are solely responsible for your Nimiq wallet, your keys, and providing a correct
              payout address. We are <strong>non-custodial</strong> and never hold your funds or
              keys.
            </li>
            <li>
              Blockchain transactions are irreversible. We are not responsible for losses caused by
              an incorrect address, a compromised wallet, or errors on your side.
            </li>
            <li>Ownership of a linked wallet is proven by signing a message; no funds move.</li>
          </ul>

          <h2>4. No guaranteed earnings</h2>
          <p>
            Rewards depend on the quests available and on your submissions passing verification.
            Nothing in the Service is a promise of income, employment, or investment return, and you
            should not treat it as such.
          </p>

          <h2>5. Rewards and verification</h2>
          <p>
            Submissions are checked with a combination of deterministic rules and AI-assisted
            review. We may approve a submission, route it to review, or reject it. Fraudulent,
            low-quality, duplicated, or rule-breaking submissions may be rejected without reward.
          </p>

          <h2>6. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>submit fake, plagiarized, recycled, or manipulated proof;</li>
            <li>operate multiple or fake accounts, or engage in Sybil/farming behavior;</li>
            <li>spam, automate, or otherwise attempt to game rewards or reputation;</li>
            <li>post or complete illegal, harmful, or deceptive tasks;</li>
            <li>disrupt, probe, or attempt to compromise the Service or other users.</li>
          </ul>

          <h2>7. Creator responsibilities</h2>
          <p>
            If you publish quests, you are responsible for making them lawful, accurate, and clearly
            described, for funding the rewards you offer, and for not requesting illegal or harmful
            actions.
          </p>

          <h2>8. Reputation, suspension, and termination</h2>
          <p>
            We may limit, suspend, or terminate accounts that violate these Terms or our anti-fraud
            rules, and may adjust reputation or withhold rewards where abuse is detected.
          </p>

          <h2>9. Availability and changes</h2>
          <p>
            The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
            We may add, modify, or discontinue features at any time.
          </p>

          <h2>10. Disclaimers and limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, we disclaim all warranties and are not liable for
            indirect, incidental, or consequential damages, or for lost NIM resulting from your use
            of the Service, third-party platforms, or the Nimiq network.
          </p>

          <h2>11. Third-party services</h2>
          <p>
            Telegram and the Nimiq network are independent services with their own terms. Your use of
            them is governed by their respective policies.
          </p>

          <h2>12. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes
            take effect means you accept the updated Terms.
          </p>

          <h2>13. Contact</h2>
          <p>
            Questions about these Terms? Reach us through the Telegram bot or via our{" "}
            <a href="https://github.com/David-patrick-chuks/NimiqEarn-Quest">GitHub repository</a>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
