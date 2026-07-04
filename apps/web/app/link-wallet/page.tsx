"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

// Same-origin: the web server proxies /api/wallet/verify/* to the API (see next.config.ts),
// so the browser never makes a cross-origin request and doesn't need to reach the API directly.
const API_BASE = "";
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? "https://hub.nimiq.com";

type Status = "loading" | "ready" | "signing" | "success" | "error";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
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
  const [challenge, setChallenge] = useState<{ message: string } | null>(null);
  const [linkedAddress, setLinkedAddress] = useState<string | null>(null);
  const [onChain, setOnChain] = useState<{ reachable: boolean; balanceNim: number | null } | null>(
    null,
  );
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
        const data = (await res.json()) as { challenge: { message: string } };
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
      // Bundled Hub SDK, imported lazily so it only loads in the browser (opens the signing popup).
      const mod = (await import("@nimiq/hub-api")) as unknown as {
        default?: new (url: string) => HubLike;
        HubApi?: new (url: string) => HubLike;
      };
      const HubApi = mod.default ?? mod.HubApi;
      if (!HubApi) throw new Error("Could not load the Nimiq signing library.");

      // No `signer` — the user picks which wallet to sign with; we derive the address from it.
      const hub = new HubApi(HUB_URL);
      const signed = await hub.signMessage({
        appName: "NimiqEarn Quest",
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

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        wallet?: { nimiqAddress: string };
        onChain?: { reachable: boolean; balanceNim: number | null };
      };

      if (!res.ok) {
        throw new Error(body.error ?? "Verification failed. Please try again from Telegram.");
      }

      setLinkedAddress(body.wallet?.nimiqAddress ?? null);
      setOnChain(body.onChain ?? null);
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
        {linkedAddress && (
          <p className="mt-4 break-all rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-[var(--brand-muted)]">
            <span className="font-semibold text-white">{linkedAddress}</span>
          </p>
        )}
        {onChain?.reachable && (
          <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-[var(--brand-muted)]">
            On-chain balance:{" "}
            <span className="font-semibold text-white">
              {onChain.balanceNim?.toLocaleString() ?? 0} NIM
            </span>
          </p>
        )}
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
      <h1 className="text-xl font-bold text-white">Link your Nimiq wallet</h1>
      <p className="mt-3 text-sm text-[var(--brand-muted)]">
        Choose a wallet and sign a short message to prove you own it. It moves no funds and
        authorizes no transaction — the address is read from your signature.
      </p>
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
