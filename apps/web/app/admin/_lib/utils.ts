export function buildQuery(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

export const PAGE_SIZE = 20;

export type AdminNavItem = {
  href: string;
  label: string;
  /** Match the path exactly instead of prefix-matching (used for the Overview root). */
  exact?: boolean;
};

export const NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/queue", label: "Queue" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/quests", label: "Quests" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/feedback", label: "Feedback" },
];
