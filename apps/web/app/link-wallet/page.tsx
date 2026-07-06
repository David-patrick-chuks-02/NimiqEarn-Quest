"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

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
  // Preloaded signers. The Nimiq Hub opens a popup, which browsers only allow from
  // within a user gesture — if we `await import(...)` the SDK *inside* the click handler,
  // the gesture is already gone and the popup is blocked ("failed to open popup"). So we
  // load the SDK ahead of time and keep the signer here, ready to call synchronously.
  const hubRef = useRef<HubLike | null>(null);
  const nimiqPayRef = useRef<NimiqPaySigner | null>(null);
  const [signerReady, setSignerReady] = useState(false);

  // Preload the right signer as soon as the page mounts, before the user clicks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window !== "undefined" && (window as WithNimiqPay).nimiqPay) {
          const { init } = await import("@nimiq/mini-app-sdk");
          const nimiq = (await init()) as unknown as NimiqPaySigner;
          if (!cancelled) nimiqPayRef.current = nimiq;
        } else {
          const mod = (await import("@nimiq/hub-api")) as unknown as {
            default?: new (url: string) => HubLike;
            HubApi?: new (url: string) => HubLike;
          };
          const HubApi = mod.default ?? mod.HubApi;
          if (HubApi && !cancelled) hubRef.current = new HubApi(HUB_URL);
        }
      } catch {
        // Leave the refs empty — sign() falls back to a lazy import if preloading failed.
      } finally {
        if (!cancelled) setSignerReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      let publicKey: string;
      let signature: string;

      // Prefer the signer preloaded on mount so the Hub popup opens inside the click
      // gesture (no `await` before signMessage). Fall back to a lazy import only if
      // preloading hasn't finished or failed.
      let nimiqPay = nimiqPayRef.current;
      let hub = hubRef.current;
      if (!nimiqPay && !hub) {
        if (typeof window !== "undefined" && (window as WithNimiqPay).nimiqPay) {
          const { init } = await import("@nimiq/mini-app-sdk");
          nimiqPay = (await init()) as unknown as NimiqPaySigner;
        } else {
          const mod = (await import("@nimiq/hub-api")) as unknown as {
            default?: new (url: string) => HubLike;
            HubApi?: new (url: string) => HubLike;
          };
          const HubApi = mod.default ?? mod.HubApi;
          if (!HubApi) throw new Error("Could not load the Nimiq signing library.");
          hub = new HubApi(HUB_URL);
        }
      }

      if (nimiqPay) {
        // Inside Nimiq Pay: sign natively through the injected provider (native dialog, no web tab).
        const signed = await nimiqPay.sign(challenge.message);
        if ("error" in signed) {
          throw new Error(signed.error.message || "Signing was cancelled.");
        }
        publicKey = signed.publicKey;
        signature = signed.signature;
      } else if (hub) {
        // Regular browser: open the Nimiq Hub popup. Called first thing in this gesture so
        // the browser lets the popup through. No `signer` — the user picks the wallet.
        const signed = await hub.signMessage({
          appName: "NimiqEarn Quest",
          message: challenge.message,
        });
        publicKey = toHex(signed.signerPublicKey);
        signature = toHex(signed.signature);
      } else {
        throw new Error("Could not load the Nimiq signing library.");
      }

      const res = await fetch(`${API_BASE}/api/wallet/verify/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, signature }),
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
        Sign a short message to prove you own your wallet. It moves no funds and authorizes no
        transaction — the address is read from your signature.
      </p>
      <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-[var(--brand-muted)]">
        💡 Best experience: open this page in <span className="text-white">Nimiq Pay</span> (Mini
        Apps) to sign right in your wallet. It also works in any browser.
      </p>
      <button
        onClick={sign}
        disabled={status === "signing" || !signerReady}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--brand-gold)] px-6 py-3 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-gold-600)] disabled:opacity-60"
      >
        {status === "signing"
          ? "Waiting for signature…"
          : signerReady
            ? "Sign with Nimiq"
            : "Preparing signer…"}
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

// The Nimiq Pay Mini App SDK's signer, injected inside the Nimiq Pay app.
interface NimiqPaySigner {
  sign(
    message: string,
  ): Promise<{ publicKey: string; signature: string } | { error: { message: string } }>;
}

// Nimiq Pay injects `window.nimiqPay` before the page's scripts run.
type WithNimiqPay = Window & { nimiqPay?: unknown };
