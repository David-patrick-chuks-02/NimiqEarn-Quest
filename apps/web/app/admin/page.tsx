"use client";

import { useCallback, useEffect, useState } from "react";

type Tab = "queue" | "submissions" | "moderation" | "users";

interface SubmissionRow {
  id: string;
  status: string;
  verificationOutcome: string | null;
  confidenceScore: number | null;
  moderationQueue?: string | null;
  questTitle: string;
  telegramId: string;
  displayName: string | null;
  reputationScore: number;
  proofPreview?: string;
  decisionReasons?: string[];
  createdAt: string;
}

interface ModerationRow {
  id: string;
  submissionId: string;
  flagType: string;
  resolution: string;
  createdAt: string;
}

interface UserRow {
  id: string;
  telegramId: string;
  displayName: string | null;
  status: string;
  reputationScore: number;
}

const KEY_STORAGE = "nimiqearn_admin_key";

async function adminFetch(path: string, key: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "x-admin-key": key,
      "content-type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [tab, setTab] = useState<Tab>("queue");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [moderation, setModeration] = useState<ModerationRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) setKey(saved);
  }, []);

  const load = useCallback(async () => {
    if (!key.trim()) {
      setError("Enter ADMIN_API_KEY to continue.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      localStorage.setItem(KEY_STORAGE, key.trim());
      if (tab === "queue") {
        const data = await adminFetch(
          "/api/admin/submissions?queue=PLATFORM&limit=50",
          key.trim(),
        );
        setSubmissions(data.items ?? []);
      } else if (tab === "submissions") {
        const data = await adminFetch("/api/admin/submissions?limit=50", key.trim());
        setSubmissions(data.items ?? []);
      } else if (tab === "moderation") {
        const data = await adminFetch("/api/admin/moderation?limit=50", key.trim());
        setModeration(data.items ?? []);
      } else {
        const data = await adminFetch("/api/admin/users?limit=50", key.trim());
        setUsers(data.items ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [key, tab]);

  useEffect(() => {
    if (key.trim()) void load();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function resolve(id: string, action: "accept" | "reject") {
    try {
      await adminFetch(`/api/admin/submissions/${id}/${action}`, key.trim(), {
        method: "POST",
        body: "{}",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function suspendUser(userId: string, status: "SUSPENDED" | "ACTIVE") {
    try {
      await adminFetch(`/api/admin/users/${userId}/status`, key.trim(), {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <header className="mb-8">
        <p className="font-[family-name:var(--font-head)] text-3xl tracking-tight text-[var(--brand-gold)]">
          NimiqEarn
        </p>
        <h1 className="mt-1 text-xl text-[var(--brand-text)]">Moderator console</h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--brand-muted)]">
          Platform queue handles MANUAL_REVIEW. Creators still own LIGHT_REVIEW in Studio.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm text-[var(--brand-muted)]">
          Admin API key
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="rounded-md border border-white/10 bg-[var(--brand-navy-700)] px-3 py-2 text-[var(--brand-text)]"
            placeholder="ADMIN_API_KEY"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md bg-[var(--brand-gold)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)]"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <nav className="mb-4 flex flex-wrap gap-2 text-sm">
        {(["queue", "submissions", "moderation", "users"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "rounded-md bg-white/10 px-3 py-1.5 text-[var(--brand-gold)]"
                : "rounded-md px-3 py-1.5 text-[var(--brand-muted)] hover:bg-white/5"
            }
          >
            {t === "queue" ? "platform queue" : t}
          </button>
        ))}
      </nav>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {(tab === "queue" || tab === "submissions") && (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-[var(--brand-navy-800)] text-[var(--brand-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Quest</th>
                <th className="px-3 py-2 font-medium">Worker</th>
                <th className="px-3 py-2 font-medium">Outcome</th>
                <th className="px-3 py-2 font-medium">Conf</th>
                {tab === "queue" && <th className="px-3 py-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-t border-white/5 align-top">
                  <td className="px-3 py-2">
                    <div>{s.questTitle}</div>
                    {s.proofPreview && (
                      <p className="mt-1 max-w-xs truncate text-[0.7rem] text-[var(--brand-muted)]">
                        {s.proofPreview}
                      </p>
                    )}
                    {s.decisionReasons && s.decisionReasons.length > 0 && (
                      <ul className="mt-1 list-disc pl-4 text-[0.65rem] text-[var(--brand-muted)]">
                        {s.decisionReasons.slice(0, 3).map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {s.displayName ?? s.telegramId}
                    <span className="ml-1 text-[var(--brand-muted)]">rep {s.reputationScore}</span>
                  </td>
                  <td className="px-3 py-2">{s.verificationOutcome ?? "—"}</td>
                  <td className="px-3 py-2">
                    {s.confidenceScore != null ? s.confidenceScore.toFixed(2) : "—"}
                  </td>
                  {tab === "queue" && (
                    <td className="px-3 py-2 space-x-3">
                      <button
                        type="button"
                        className="text-[var(--brand-gold)] underline"
                        onClick={() => void resolve(s.id, "accept")}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="text-red-300 underline"
                        onClick={() => void resolve(s.id, "reject")}
                      >
                        Reject
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-[var(--brand-muted)]">
                    {tab === "queue" ? "Platform queue is empty." : "No submissions yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "moderation" && (
        <ul className="space-y-2">
          {moderation.map((m) => (
            <li
              key={m.id}
              className="rounded-md border border-white/10 bg-[var(--brand-navy-800)] px-3 py-2 text-sm"
            >
              <span className="text-[var(--brand-gold)]">{m.resolution}</span>
              <span className="mx-2 text-[var(--brand-muted)]">{m.flagType}</span>
              <span className="text-[var(--brand-muted)]">{m.submissionId.slice(0, 8)}…</span>
              <span className="float-right text-[var(--brand-muted)]">
                {new Date(m.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
          {moderation.length === 0 && (
            <li className="text-sm text-[var(--brand-muted)]">No moderation events.</li>
          )}
        </ul>
      )}

      {tab === "users" && (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-[var(--brand-navy-800)] text-[var(--brand-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Rep</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="px-3 py-2">
                    {u.displayName ?? "—"}{" "}
                    <span className="text-[var(--brand-muted)]">{u.telegramId}</span>
                  </td>
                  <td className="px-3 py-2">{u.status}</td>
                  <td className="px-3 py-2">{u.reputationScore}</td>
                  <td className="px-3 py-2">
                    {u.status === "SUSPENDED" ? (
                      <button
                        type="button"
                        className="text-[var(--brand-gold)] underline"
                        onClick={() => void suspendUser(u.id, "ACTIVE")}
                      >
                        Reinstate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-red-300 underline"
                        onClick={() => void suspendUser(u.id, "SUSPENDED")}
                      >
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
