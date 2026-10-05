"use client";

import Link from "next/link";
import { useState } from "react";
import { shortId } from "../_lib/utils";

export function StatusPill({ value }: { value: string }) {
  const tone =
    value === "ACTIVE" || value === "ACCEPTED" || value === "PUBLISHED" || value === "VERIFIED"
      ? "bg-[var(--brand-gold)]/10 text-[var(--brand-gold)]"
      : value === "SUSPENDED" || value === "REJECTED" || value === "CLOSED"
        ? "bg-red-500/10 text-red-200"
        : "bg-white/5 text-[var(--brand-muted)]";
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[0.65rem] font-medium ${tone}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white/35">{label}</p>
      <div className="mt-1 break-words text-sm text-[var(--brand-text)]">{children}</div>
    </div>
  );
}

export function CopyId({ id, label = "id" }: { id: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setCopied(true);
          setTimeout(() => setCopied(false), 1000);
        } catch {
          // ignore
        }
      }}
      className="inline-flex items-center gap-1 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--brand-muted)] hover:text-white"
    >
      <span className="text-white/30">{label}</span>
      {copied ? "copied" : shortId(id)}
    </button>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-[var(--brand-muted)]">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  meta,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  meta?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[16rem] flex-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/10 bg-[var(--brand-navy-700)] py-2 pl-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-gold)]/30"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--brand-muted)] hover:text-white"
          >
            ×
          </button>
        )}
      </div>
      {meta && <p className="text-xs tabular-nums text-[var(--brand-muted)]">{meta}</p>}
    </div>
  );
}

export function Pager({
  page,
  pageCount,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (pageCount <= 1) return null;
  const btn =
    "rounded-lg border border-white/12 px-3 py-1.5 text-sm text-white disabled:opacity-40 hover:bg-white/5";
  return (
    <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
      <button type="button" className={btn} disabled={page <= 0 || loading} onClick={onPrev}>
        Previous
      </button>
      <p className="text-xs tabular-nums text-[var(--brand-muted)]">
        Page {page + 1} / {pageCount}
      </p>
      <button type="button" className={btn} disabled={page + 1 >= pageCount || loading} onClick={onNext}>
        Next
      </button>
    </div>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-[var(--brand-muted)]">
      {message}
    </div>
  );
}

export function DetailLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-white hover:text-[var(--brand-gold)] hover:underline">
      {children}
    </Link>
  );
}

export const ghostBtn =
  "inline-flex items-center justify-center rounded-lg border border-white/12 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50";
export const primaryBtn =
  "inline-flex items-center justify-center rounded-lg bg-[var(--brand-gold)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-gold-600)] disabled:opacity-50";
export const dangerBtn =
  "inline-flex items-center justify-center rounded-md border border-red-400/30 px-2.5 py-1 text-xs font-medium text-red-200 hover:bg-red-500/10 disabled:opacity-50";
export const acceptBtn =
  "inline-flex items-center justify-center rounded-md border border-[var(--brand-gold)]/35 px-2.5 py-1 text-xs font-medium text-[var(--brand-gold)] hover:bg-[var(--brand-gold)]/10 disabled:opacity-50";
