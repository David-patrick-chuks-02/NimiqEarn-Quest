"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? "https://hub.nimiq.com";
// Loaded at runtime so we don't need a build-time dependency on the Hub SDK.
const HUB_SDK_URL = process.env.NEXT_PUBLIC_HUB_SDK_URL ?? "https://esm.sh/@nimiq/hub-api@1";

type Status = "loading" | "ready" | "signing" | "success" | "error";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Image
            src="/logo.png"
            alt="NimiqEarn Quest logo"
            width={32}
            height={34}
            className="rounded-lg"
          />
          <span className="text-lg font-bold tracking-tight">
            Nimiq<span className="text-[var(--brand-gold)]">Earn</span> Quest
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}

export default function LinkWalletPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ address: string; message: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) {
      setError("Missing verification token. Please reopen the link from Telegram.");
      setStatus("error");
      return;
    }
    setToken(t);

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/wallet/verify/${encodeURIComponent(t)}`);
        if (!res.ok) {
          throw new Error("This verification link is invalid or has expired.");
        }
        const data = (await res.json()) as { challenge: { address: string; message: string } };
        setChallenge(data.challenge);
        setStatus("ready");
      } catch (e) {
        setError((e as Error).message);
        setStatus("error");
      }
    })();
  }, []);

  const sign = useCallback(async () => {
    if (!token || !challenge) return;
    setStatus("signing");
    setError("");

    try {
      // Runtime import of the Nimiq Hub SDK (opens the signing popup).
      const mod = (await import(/* webpackIgnore: true */ HUB_SDK_URL)) as {
        default?: new (url: string) => HubLike;
        HubApi?: new (url: string) => HubLike;
      };
      const HubApi = mod.default ?? mod.HubApi;
      if (!HubApi) throw new Error("Could not load the Nimiq signing library.");

      const hub = new HubApi(HUB_URL);
      const signed = await hub.signMessage({
        appName: "NimiqEarn Quest",
        signer: challenge.address,
        message: challenge.message,
      });

      const res = await fetch(`${API_BASE}/api/wallet/verify/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: toHex(signed.signerPublicKey),
          signature: toHex(signed.signature),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Verification failed. Please try again from Telegram.");
      }

      setStatus("success");
    } catch (e) {
      setError((e as Error)?.message ?? "Signing was cancelled or failed.");
      setStatus("error");
    }
  }, [token, challenge]);

  if (status === "loading") {
    return (
      <Panel>
        <p className="text-[var(--brand-muted)]">Loading your verification request…</p>
      </Panel>
    );
  }

  if (status === "success") {
    return (
      <Panel>
        <h1 className="text-xl font-bold text-white">Wallet verified ✓</h1>
        <p className="mt-3 text-sm text-[var(--brand-muted)]">
          Your Nimiq wallet is now linked and verified. Return to Telegram and tap{" "}
          <span className="font-semibold text-white">I&apos;ve signed</span> to continue.
        </p>
      </Panel>
    );
  }

  if (status === "error") {
    return (
      <Panel>
        <h1 className="text-xl font-bold text-white">Something went wrong</h1>
        <p className="mt-3 text-sm text-[var(--brand-muted)]">{error}</p>
        {challenge && (
          <button
            onClick={sign}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--brand-gold)] px-6 py-3 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-gold-600)]"
          >
            Try again
          </button>
        )}
      </Panel>
    );
  }

  return (
    <Panel>
      <h1 className="text-xl font-bold text-white">Verify wallet ownership</h1>
      <p className="mt-3 text-sm text-[var(--brand-muted)]">
        You&apos;ll sign a short message to prove you own this wallet. It moves no funds and
        authorizes no transaction.
      </p>
      {challenge && (
        <p className="mt-4 break-all rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-[var(--brand-muted)]">
          {challenge.address}
        </p>
      )}
      <button
        onClick={sign}
        disabled={status === "signing"}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--brand-gold)] px-6 py-3 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-gold-600)] disabled:opacity-60"
      >
        {status === "signing" ? "Waiting for signature…" : "Sign with Nimiq"}
      </button>
    </Panel>
  );
}

interface HubLike {
  signMessage(request: { appName: string; signer?: string; message: string }): Promise<{
    signerPublicKey: Uint8Array;
    signature: Uint8Array;
  }>;
}
