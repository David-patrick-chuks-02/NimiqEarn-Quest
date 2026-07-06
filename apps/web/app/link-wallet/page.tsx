"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

// Same-origin: the web server proxies /api/wallet/verify/* to the API (see next.config.ts),
// so the browser never makes a cross-origin request and doesn't need to reach the API directly.
const API_BASE = "";
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? "https://hub.nimiq.com";

type Status = "loading" | "ready" | "signing" | "success" | "already-linked" | "error";

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

  // Signers loaded up front so signing starts without an `await import()` in the click
  // handler (which would break popups) and so we can catch the Hub's redirect response.
  const hubRef = useRef<HubInstance | null>(null);
  const hubApiRef = useRef<HubApiStatic | null>(null);
  const nimiqPayRef = useRef<NimiqPaySigner | null>(null);

  // Submit the signed proof to the API and map the response to a UI state.
  const submitSignature = useCallback(
    async (tkn: string, publicKey: string, signature: string) => {
      setStatus("signing");
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/wallet/verify/${encodeURIComponent(tkn)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey, signature }),
        });

        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          wallet?: { nimiqAddress: string };
          onChain?: { reachable: boolean; balanceNim: number | null };
        };

        if (!res.ok) {
          // Re-signing a wallet you already own isn't a failure — the goal is already met.
          if (res.status === 409 && body.code === "ALREADY_LINKED") {
            setStatus("already-linked");
            return;
          }
          throw new Error(body.error ?? "Verification failed. Please try again from Telegram.");
        }

        setLinkedAddress(body.wallet?.nimiqAddress ?? null);
        setOnChain(body.onChain ?? null);
        setStatus("success");
      } catch (e) {
        setError((e as Error)?.message ?? "Verification failed. Please try again from Telegram.");
        setStatus("error");
      }
    },
    [],
  );

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) {
      setError("Missing verification token. Please reopen the link from Telegram.");
      setStatus("error");
      return;
    }
    setToken(t);

    let cancelled = false;

    (async () => {
      const inNimiqPay = typeof window !== "undefined" && Boolean((window as WithNimiqPay).nimiqPay);

      if (inNimiqPay) {
        try {
          const { init } = await import("@nimiq/mini-app-sdk");
          const nimiq = (await init()) as unknown as NimiqPaySigner;
          if (!cancelled) nimiqPayRef.current = nimiq;
        } catch {
          // Leave the ref empty — sign() surfaces a clear error if it stays null.
        }
      } else {
        try {
          const mod = (await import("@nimiq/hub-api")) as unknown as {
            default?: HubApiStatic;
            HubApi?: HubApiStatic;
          };
          const HubApi = mod.default ?? mod.HubApi;
          if (HubApi) {
            const hub = new HubApi(HUB_URL);
            hubApiRef.current = HubApi;
            hubRef.current = hub;

            // If we're returning from the Hub's redirect, these fire during checkRedirectResponse().
            let handledRedirect = false;
            hub.on(
              HubApi.RequestType.SIGN_MESSAGE,
              (result, state) => {
                handledRedirect = true;
                const stateToken =
                  state && typeof state === "object" && "token" in state
                    ? String((state as { token?: string }).token ?? "")
                    : "";
                void submitSignature(
                  stateToken || t,
                  toHex(result.signerPublicKey),
                  toHex(result.signature),
                );
              },
              (err) => {
                handledRedirect = true;
                setError(err?.message ?? "Signing was cancelled or failed.");
                setStatus("error");
              },
            );

            await hub.checkRedirectResponse();
            if (handledRedirect) return; // Returning from the Hub — the handler drives the UI.
          }
        } catch {
          // Fall through to load the challenge; sign() handles a missing hub.
        }
      }

      if (cancelled) return;

      try {
        const res = await fetch(`${API_BASE}/api/wallet/verify/${encodeURIComponent(t)}`);
        if (!res.ok) {
          throw new Error("This verification link is invalid or has expired.");
        }
        const data = (await res.json()) as { challenge: { message: string } };
        if (!cancelled) {
          setChallenge(data.challenge);
          setStatus("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [submitSignature]);

  const sign = useCallback(async () => {
    if (!token || !challenge) return;
    setError("");

    // Nimiq Pay: sign natively through the injected provider (native dialog, no web tab).
    const nimiqPay = nimiqPayRef.current;
    if (nimiqPay) {
      setStatus("signing");
      try {
        const signed = await nimiqPay.sign(challenge.message);
        if ("error" in signed) {
          throw new Error(signed.error.message || "Signing was cancelled.");
        }
        await submitSignature(token, signed.publicKey, signed.signature);
      } catch (e) {
        setError((e as Error)?.message ?? "Signing was cancelled or failed.");
        setStatus("error");
      }
      return;
    }

    // Regular browser (incl. Telegram's in-app browser): redirect to the Hub instead of a
    // popup. Popups are blocked inside embedded webviews, which is what caused the Hub's
    // "invalid request" error. On return, checkRedirectResponse() (above) completes the flow.
    const hub = hubRef.current;
    const HubApi = hubApiRef.current;
    if (!hub || !HubApi) {
      setError("Could not load the Nimiq signing library. Please reload and try again.");
      setStatus("error");
      return;
    }

    setStatus("signing");
    try {
      const returnUrl = window.location.origin + window.location.pathname + window.location.search;
      const behavior = new HubApi.RedirectRequestBehavior(returnUrl, { token });
      await hub.signMessage({ appName: "NimiqEarn Quest", message: challenge.message }, behavior);
    } catch (e) {
      setError((e as Error)?.message ?? "Could not open the Nimiq signing page.");
      setStatus("error");
    }
  }, [token, challenge, submitSignature]);

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
          Your Nimiq wallet is now linked and verified. Return to Telegram to continue.
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

  if (status === "already-linked") {
    return (
      <Panel>
        <h1 className="text-xl font-bold text-white">Wallet already linked ✓</h1>
        <p className="mt-3 text-sm text-[var(--brand-muted)]">
          This wallet is already linked to your account — you&apos;re all set. Return to Telegram to
          continue. To manage or add another wallet, open <span className="text-white">My Wallets</span>.
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
        disabled={status === "signing"}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--brand-gold)] px-6 py-3 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-gold-600)] disabled:opacity-60"
      >
        {status === "signing" ? "Opening Nimiq…" : "Sign with Nimiq"}
      </button>
    </Panel>
  );
}

interface SignedMessage {
  signerPublicKey: Uint8Array;
  signature: Uint8Array;
}

interface HubInstance {
  signMessage(
    request: { appName: string; message: string },
    behavior?: object,
  ): Promise<SignedMessage | void>;
  on(
    command: string,
    resolve: (result: SignedMessage, state: unknown) => void,
    reject?: (error: Error, state: unknown) => void,
  ): void;
  checkRedirectResponse(): Promise<void>;
}

interface HubApiStatic {
  new (url: string): HubInstance;
  RequestType: { SIGN_MESSAGE: string };
  RedirectRequestBehavior: new (returnUrl?: string, localState?: unknown) => object;
}

// The Nimiq Pay Mini App SDK's signer, injected inside the Nimiq Pay app.
interface NimiqPaySigner {
  sign(
    message: string,
  ): Promise<{ publicKey: string; signature: string } | { error: { message: string } }>;
}

// Nimiq Pay injects `window.nimiqPay` before the page's scripts run.
type WithNimiqPay = Window & { nimiqPay?: unknown };
