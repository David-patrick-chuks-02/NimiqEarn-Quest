"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminAuthProvider, useAdminAuth } from "../_lib/auth";
import { NAV } from "../_lib/utils";
import { ghostBtn, primaryBtn } from "./ui";

function LoginGate() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-white/10 bg-[var(--brand-navy-800)]/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={36} height={36} className="rounded-md" priority />
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[var(--brand-gold)]">
              Operations
            </p>
            <h1 className="text-xl font-bold text-white">Sign in</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--brand-muted)]">
          Use your admin email and password to open the ops console.
        </p>
        <label className="mt-5 block text-xs text-[var(--brand-muted)]">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[var(--brand-navy-700)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-gold)]/30"
            placeholder="admin@example.com"
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--brand-muted)]">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[var(--brand-navy-700)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-gold)]/30"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <button type="button" className={`${primaryBtn} mt-4 w-full`} disabled={busy} onClick={() => void submit()}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <Link href="/" className={`${ghostBtn} mt-3 w-full`}>
          Back to site
        </Link>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, unlocked, adminFetch, email } = useAdminAuth();

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    const rest = [
      "/api/admin/submissions?limit=20&offset=0&queue=PLATFORM",
      "/api/admin/submissions?limit=20&offset=0",
      "/api/admin/quests?limit=20&offset=0",
      "/api/admin/users?limit=20&offset=0",
      "/api/admin/moderation?limit=20&offset=0",
      "/api/admin/feedback?limit=20&offset=0",
    ];
    (async () => {
      await adminFetch("/api/admin/overview").catch(() => undefined);
      for (const path of rest) {
        if (cancelled) return;
        await adminFetch(path).catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, adminFetch]);

  return (
    <div className="min-h-screen bg-[var(--brand-navy-900)] text-[var(--brand-text)]">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[var(--brand-navy-900)]/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" prefetch className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="" width={28} height={28} className="rounded-md" priority />
            <div>
              <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-[var(--brand-gold)]">
                NimiqEarn
              </p>
              <p className="text-sm font-semibold text-white">Operations</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {email && (
              <span className="hidden text-xs text-[var(--brand-muted)] sm:inline">{email}</span>
            )}
            <button type="button" className={ghostBtn} onClick={logout}>
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]"
                    : "text-[var(--brand-muted)] hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { unlocked } = useAdminAuth();
  if (!unlocked) return <LoginGate />;
  return <Shell>{children}</Shell>;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <Gate>{children}</Gate>
    </AdminAuthProvider>
  );
}
