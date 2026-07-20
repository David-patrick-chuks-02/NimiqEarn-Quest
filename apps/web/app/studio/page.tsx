"use client";

import Script from "next/script";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnalyticsDetail, AnalyticsSkeleton, type Analytics } from "./_analytics";

const CATEGORIES = [
  { value: "PRODUCT_TESTING", label: "Product testing" },
  { value: "SOCIAL_CAMPAIGN", label: "Social campaign" },
  { value: "COMMUNITY_ENGAGEMENT", label: "Community engagement" },
  { value: "REFERRAL", label: "Referral" },
  { value: "CONTENT", label: "Content" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "BUG_BOUNTY", label: "Bug bounty" },
  { value: "OTHER", label: "Other" },
] as const;

const PROOF_TYPES = [
  { value: "TEXT", label: "Text response" },
  { value: "LINK", label: "Link / URL" },
  { value: "SCREENSHOT", label: "Screenshot" },
  { value: "TRANSACTION_HASH", label: "Transaction hash" },
  { value: "REFERRAL_EVENT", label: "Referral event" },
] as const;

type Phase = "loading" | "no-telegram" | "not-creator" | "ready" | "error";
type TabKey = "home" | "create" | "quests" | "wallet";

interface Quest {
  id: string;
  title: string;
  category: string;
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
  startAt: string | null;
  scheduled: boolean;
  promoted: boolean;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
  escrowAddress: string | null;
  viewCount: number;
  publishedAt: string | null;
}

interface Dashboard {
  user: { displayName: string | null; role: string; status: string };
  quests: { total: number; DRAFT: number; PUBLISHED: number; CLOSED: number };
}

const emptyForm = {
  title: "",
  category: "SOCIAL_CAMPAIGN",
  description: "",
  rewardAmount: "",
  totalSlots: "",
  startAt: "",
  proofType: "LINK",
  proofInstructions: "",
  sampleEvidence: "", // compressed image data URL, optional
};

/**
 * Read an image File and return a compressed JPEG data URL (max ~1000px, quality 0.7),
 * so sample-evidence uploads stay small enough to store inline. Rejects non-images.
 */
async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    // Note: `Image` in this module is next/image, so use the DOM element explicitly.
    const el = document.createElement("img");
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That doesn't look like an image."));
    el.src = dataUrl;
  });
  const max = 1000;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

const inputClass =
  "mt-1.5 block w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-[var(--brand-navy-700)] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[var(--brand-gold)] focus:ring-1 focus:ring-[var(--brand-gold)] placeholder:text-[var(--brand-muted)]";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]";

export default function StudioPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState<{
    nim: number | null;
    reachable: boolean;
    address: string | null;
  }>({ nim: null, reachable: false, address: null });
  const [tab, setTab] = useState<TabKey>("home");
  const [confirmQuest, setConfirmQuest] = useState<Quest | null>(null);
  // Holds the validated create payload while the creator chooses publish-now vs draft.
  const [createConfirm, setCreateConfirm] = useState<{ payload: Record<string, unknown> } | null>(
    null,
  );
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  // Per-quest analytics viewed inline (no separate Mini App). analyticsData null while loading.
  const [analyticsFor, setAnalyticsFor] = useState<{ id: string; title: string } | null>(null);
  const [analyticsData, setAnalyticsData] = useState<Analytics | null>(null);
  const analyticsReqRef = useRef<string | null>(null);
  const [config, setConfig] = useState<{
    feePercent: number;
    promotionAvailable: boolean;
    promotionFeeNim: number;
  }>({ feePercent: 0, promotionAvailable: false, promotionFeeNim: 0 });
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [faucetOpen, setFaucetOpen] = useState(false);
  const initDataRef = useRef<string>("");

  // Reward pool the creator funds = reward per completion × number of taskers, plus the
  // platform fee charged on top at publish.
  const reward = Number(form.rewardAmount);
  const slots = Number(form.totalSlots);
  const pool =
    Number.isFinite(reward) && Number.isFinite(slots) && reward > 0 && slots > 0
      ? reward * slots
      : null;
  const platformFee = pool != null ? Math.round(pool * (config.feePercent / 100)) : null;
  const totalCost = pool != null ? pool + (platformFee ?? 0) : null;

  // Earliest schedulable start for the picker: now (local, formatted for datetime-local).
  const minStart = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  })();

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const headers: Record<string, string> = {
      "x-telegram-init-data": initDataRef.current,
      ...((init?.headers as Record<string, string>) ?? {}),
    };
    // Only declare a JSON content-type when we actually send a body — Fastify rejects an
    // empty body with content-type application/json (bodyless POSTs: publish, register).
    if (init?.body != null) headers["Content-Type"] = "application/json";
    const res = await fetch(path, { ...init, headers });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error((body.error as string) ?? `Request failed (${res.status})`);
    }
    return body;
  }, []);

  // Open a quest's analytics inline: swap to the detail view immediately (skeleton with the
  // real title), then load. A stale response is ignored if the user backs out or opens another.
  const openAnalytics = useCallback(
    async (quest: Quest) => {
      analyticsReqRef.current = quest.id;
      setAnalyticsFor({ id: quest.id, title: quest.title });
      setAnalyticsData(null);
      setError("");
      try {
        const resBody = (await api(`/api/studio/quests/${quest.id}/analytics`)) as {
          analytics?: Analytics;
        };
        if (analyticsReqRef.current !== quest.id) return;
        if (resBody.analytics) setAnalyticsData(resBody.analytics);
        else setAnalyticsFor(null);
      } catch (e) {
        if (analyticsReqRef.current !== quest.id) return;
        setError((e as Error).message);
        setAnalyticsFor(null); // back to the studio home, where the error shows
      }
    },
    [api],
  );

  const closeAnalytics = useCallback(() => {
    analyticsReqRef.current = null;
    setAnalyticsFor(null);
    setAnalyticsData(null);
  }, []);

  const loadQuests = useCallback(async () => {
    const body = (await api("/api/studio/quests")) as { quests?: Quest[] };
    setQuests(body.quests ?? []);
  }, [api]);

  // Shareable public quest link (a web page that deep-links into the bot).
  const shareQuest = useCallback(async (id: string) => {
    const url = `${window.location.origin}/q/${id}`;
    const shareApi = (navigator as Navigator & { share?: (d: { url: string }) => Promise<void> })
      .share;
    try {
      if (shareApi) {
        await shareApi.call(navigator, { url });
      } else {
        await navigator.clipboard.writeText(url);
        setSharedId(id);
        setTimeout(() => setSharedId((s) => (s === id ? null : s)), 1500);
      }
    } catch {
      // User dismissed the share sheet, or clipboard was unavailable — no-op.
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    const me = (await api("/api/studio/me")) as { dashboard?: Dashboard };
    if (me.dashboard) setDashboard(me.dashboard);
  }, [api]);

  // Creator's on-chain wallet balance — advisory, used to pre-check funding before publishing.
  const loadBalance = useCallback(async () => {
    try {
      const b = (await api("/api/studio/balance")) as {
        balanceNim?: number | null;
        reachable?: boolean;
        address?: string | null;
      };
      setBalance({
        nim: b.balanceNim ?? null,
        reachable: Boolean(b.reachable),
        address: b.address ?? null,
      });
    } catch {
      setBalance({ nim: null, reachable: false, address: null });
    }
  }, [api]);

  // Platform fee % + promotion pricing/availability — drives the fee display and Promote button.
  const loadConfig = useCallback(async () => {
    try {
      const c = (await api("/api/studio/config")) as {
        feePercent?: number;
        promotionAvailable?: boolean;
        promotionFeeNim?: number;
      };
      setConfig({
        feePercent: c.feePercent ?? 0,
        promotionAvailable: Boolean(c.promotionAvailable),
        promotionFeeNim: c.promotionFeeNim ?? 0,
      });
    } catch {
      // Non-fatal — the studio still works; fee shows as 0 until it loads.
    }
  }, [api]);

  // Manual refresh from the studio header — reloads quests, stats, and wallet balance.
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      await Promise.all([loadQuests(), refreshDashboard(), loadBalance()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [loadQuests, refreshDashboard, loadBalance]);

  const onFaucetSuccess = useCallback(
    (message: string) => {
      setNotice(message);
      setFaucetOpen(false);
      setTimeout(() => void refreshAll(), 4000);
    },
    [refreshAll],
  );

  const boot = useCallback(async () => {
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData ?? "";
    if (!initData) {
      setPhase("no-telegram");
      return;
    }
    initDataRef.current = initData;
    try {
      tg?.ready();
      tg?.expand();
      tg?.setHeaderColor?.("#070c17");
      tg?.setBackgroundColor?.("#070c17");
    } catch {
      // Older Telegram clients may not support every method — non-fatal.
    }

    try {
      const me = (await api("/api/studio/me")) as {
        creator?: boolean;
        dashboard?: Dashboard;
      };
      if (!me.creator || !me.dashboard) {
        setPhase("not-creator");
        return;
      }
      setDashboard(me.dashboard);
      await Promise.all([loadQuests(), loadBalance(), loadConfig()]);
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [api, loadQuests, loadBalance, loadConfig]);

  // If Telegram injected the SDK before hydration, boot immediately; otherwise the
  // Script onLoad handler below triggers it.
  useEffect(() => {
    if (window.Telegram?.WebApp) void boot();
  }, [boot]);

  const becomeCreator = useCallback(async () => {
    setRegistering(true);
    setError("");
    try {
      const body = (await api("/api/studio/register", { method: "POST" })) as {
        dashboard?: Dashboard;
      };
      if (body.dashboard) setDashboard(body.dashboard);
      await loadQuests();
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRegistering(false);
    }
  }, [api, loadQuests]);

  const submitQuest = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setNotice("");

      // Guard the numeric fields client-side so a stray letter gives a friendly message
      // instead of a raw "expected number" from the API.
      const rewardNum = Number(form.rewardAmount);
      const slotsNum = Number(form.totalSlots);
      if (!Number.isFinite(rewardNum) || rewardNum <= 0) {
        setError("Reward: enter a positive number of NIM.");
        return;
      }
      if (!Number.isInteger(slotsNum) || slotsNum <= 0) {
        setError("Slots: enter a whole number greater than zero.");
        return;
      }
      // Optional schedule: a datetime-local string (local time). Reject a past time; omit
      // startAt entirely when left blank (the quest goes live immediately on publish).
      let startAt: string | undefined;
      if (form.startAt) {
        const when = new Date(form.startAt);
        if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
          setError("Start time: pick a time in the future, or leave it blank to start now.");
          return;
        }
        startAt = when.toISOString();
      }

      // Don't create anything yet — ask the creator whether to publish now or save a draft.
      setCreateConfirm({
        payload: {
          title: form.title.trim(),
          category: form.category,
          description: form.description.trim(),
          rewardAmount: rewardNum,
          totalSlots: slotsNum,
          ...(startAt ? { startAt } : {}),
          proofType: form.proofType,
          proofInstructions: form.proofInstructions.trim(),
          ...(form.sampleEvidence ? { sampleEvidence: form.sampleEvidence } : {}),
        },
      });
    },
    [form],
  );

  // Finalize a quest from the confirmation modal — save as draft, or create + publish now.
  const finalizeCreate = useCallback(
    async (publishNow: boolean) => {
      const payload = createConfirm?.payload;
      if (!payload) return;
      setCreateConfirm(null);
      setSubmitting(true);
      setError("");
      setNotice("");
      let createdId: string | null = null;
      try {
        const body = (await api("/api/studio/quests", {
          method: "POST",
          body: JSON.stringify(payload),
        })) as { quest?: { id: string } };
        createdId = body.quest?.id ?? null;

        if (publishNow && createdId) {
          await api(`/api/studio/quests/${createdId}/publish`, { method: "POST" });
          setNotice("Quest published — it's now live.");
        } else {
          setNotice("Draft saved. Publish it from the Quests tab when you're ready.");
        }
        setForm(emptyForm);
        setTab("quests");
        await Promise.all([loadQuests(), refreshDashboard(), loadBalance()]);
      } catch (e2) {
        // If the draft was created but publishing failed (e.g. low balance), it's saved —
        // send them to the Quests tab to retry publishing, with the error shown.
        setError((e2 as Error).message);
        if (createdId) {
          setForm(emptyForm);
          setTab("quests");
          await Promise.all([loadQuests(), refreshDashboard()]).catch(() => undefined);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [api, createConfirm, loadQuests, refreshDashboard, loadBalance],
  );

  const publish = useCallback(
    async (id: string) => {
      setPublishingId(id);
      setError("");
      setNotice("");
      try {
        await api(`/api/studio/quests/${id}/publish`, { method: "POST" });
        setNotice("Quest published — it's now live.");
        await Promise.all([loadQuests(), refreshDashboard()]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPublishingId(null);
      }
    },
    [api, loadQuests, refreshDashboard],
  );

  // Open the publish confirmation modal; refresh the balance so its pre-check is current.
  const requestPublish = useCallback(
    (quest: Quest) => {
      setError("");
      setNotice("");
      setConfirmQuest(quest);
      void loadBalance();
    },
    [loadBalance],
  );

  const confirmPublish = useCallback(async () => {
    const quest = confirmQuest;
    if (!quest) return;
    setConfirmQuest(null);
    await publish(quest.id);
  }, [confirmQuest, publish]);

  // Promote a quest ("premium ad") — charges the flat promotion fee from the wallet.
  const promoteQuest = useCallback(
    async (id: string) => {
      setPromotingId(id);
      setError("");
      setNotice("");
      try {
        await api(`/api/studio/quests/${id}/promote`, { method: "POST" });
        setNotice("Quest promoted — it now appears first, highlighted.");
        await Promise.all([loadQuests(), loadBalance()]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPromotingId(null);
      }
    },
    [api, loadQuests, loadBalance],
  );

  // Any in-flight write blocks the whole studio behind an overlay so the user can't
  // double-submit or navigate mid-action.
  const busyLabel = submitting
    ? "Saving draft…"
    : publishingId
      ? "Publishing quest…"
      : registering
        ? "Activating creator account…"
        : null;

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={() => void boot()}
      />
      {busyLabel && <LoadingOverlay label={busyLabel} />}
      {confirmQuest && (
        <PublishConfirmModal
          quest={confirmQuest}
          balance={balance}
          onCancel={() => setConfirmQuest(null)}
          onConfirm={() => void confirmPublish()}
        />
      )}
      {faucetOpen && (
        <FaucetModal
          api={api}
          onClose={() => setFaucetOpen(false)}
          onSuccess={onFaucetSuccess}
        />
      )}
      {createConfirm && (
        <CreateConfirmModal
          payload={createConfirm.payload}
          feePercent={config.feePercent}
          balance={balance}
          onCancel={() => setCreateConfirm(null)}
          onDraft={() => void finalizeCreate(false)}
          onPublish={() => void finalizeCreate(true)}
        />
      )}
      <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6">
        <Header onRefresh={phase === "ready" ? refreshAll : undefined} refreshing={refreshing} />

        {phase === "loading" && <StudioSkeleton />}

        {phase === "no-telegram" && (
          <Info>
            Open <span className="text-white">Creator Studio</span> from the NimiqEarn Quest bot in
            Telegram — tap <span className="text-white">Open Creator Studio</span> in the Creator
            Hub.
          </Info>
        )}

        {phase === "error" && (
          <Info tone="error">
            {error || "Something went wrong."}
            <button onClick={() => void boot()} className={`${primaryBtn} mt-4`}>
              Try again
            </button>
          </Info>
        )}

        {phase === "not-creator" && (
          <div className="glass mt-4 rounded-2xl p-5 text-center">
            <h2 className="text-lg font-bold text-white">Become a creator</h2>
            <p className="mt-2 text-sm text-[var(--brand-muted)]">
              Publish paid quests and bounties for the Nimiq community. You&apos;ll need a verified
              profile with a linked Nimiq wallet.
            </p>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <button onClick={() => void becomeCreator()} disabled={registering} className={`${primaryBtn} mt-4`}>
              {registering ? "Activating…" : "Become a Creator"}
            </button>
          </div>
        )}

        {phase === "ready" && dashboard && (
          <>
            <div className="mt-5 space-y-5 pb-28">
              {!analyticsFor && TAB_META[tab] && (
                <div>
                  <h1 className="text-2xl font-bold text-white">{TAB_META[tab]!.title}</h1>
                  <p className="mt-1 text-sm text-[var(--brand-muted)]">{TAB_META[tab]!.subtitle}</p>
                </div>
              )}

              {notice && (
                <p className="rounded-xl border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/10 px-3.5 py-2.5 text-sm text-[var(--brand-gold)]">
                  {notice}
                </p>
              )}
              {error && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
                  {error}
                </p>
              )}

              {tab === "home" && (
                <>
                  <StatRow dashboard={dashboard} />
                  <WalletCard
                    balance={balance}
                    onRequestFaucet={() => {
                      setNotice("");
                      setFaucetOpen(true);
                    }}
                  />
                  <button onClick={() => setTab("create")} className={`${primaryBtn} w-full`}>
                    Create a quest
                  </button>
                </>
              )}

              {tab === "create" && (
                <form onSubmit={submitQuest} className="glass rounded-2xl p-5">
              <div className="space-y-3.5">
                <div>
                  <label className={labelClass}>Title</label>
                  <input
                    className={inputClass}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    maxLength={100}
                    placeholder="Follow us on X and repost the pinned"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Category</label>
                    <select
                      className={inputClass}
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Proof type</label>
                    <select
                      className={inputClass}
                      value={form.proofType}
                      onChange={(e) => setForm({ ...form, proofType: e.target.value })}
                    >
                      {PROOF_TYPES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    className={`${inputClass} min-h-[84px] resize-y`}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    minLength={10}
                    maxLength={2000}
                    placeholder="What should the worker do, step by step?"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Reward (NIM)</label>
                    <input
                      className={inputClass}
                      value={form.rewardAmount}
                      onChange={(e) => setForm({ ...form, rewardAmount: e.target.value })}
                      inputMode="decimal"
                      placeholder="10"
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Slots</label>
                    <input
                      className={inputClass}
                      value={form.totalSlots}
                      onChange={(e) => setForm({ ...form, totalSlots: e.target.value })}
                      inputMode="numeric"
                      placeholder="50"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Schedule start (optional)</label>
                  <input
                    type="datetime-local"
                    // appearance-none strips WebKit's oversized native widget, which otherwise
                    // ignores width and overflows the form on mobile Safari.
                    className={`${inputClass} appearance-none`}
                    value={form.startAt}
                    min={minStart}
                    onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  />
                  <p className="mt-1 text-[0.7rem] text-[var(--brand-muted)]">
                    Leave blank to go live as soon as you publish.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Proof instructions</label>
                  <textarea
                    className={`${inputClass} min-h-[64px] resize-y`}
                    value={form.proofInstructions}
                    onChange={(e) => setForm({ ...form, proofInstructions: e.target.value })}
                    minLength={5}
                    maxLength={1000}
                    placeholder="Paste the link to your repost."
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Sample evidence (optional)</label>
                  <p className="mt-1 text-[0.7rem] text-[var(--brand-muted)]">
                    Upload an example screenshot so workers know exactly what to submit.
                  </p>
                  {form.sampleEvidence ? (
                    <div className="mt-2 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.sampleEvidence}
                        alt="Sample evidence"
                        className="h-16 w-16 rounded-lg border border-white/10 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, sampleEvidence: "" })}
                        className="text-sm font-semibold text-[var(--brand-muted)] transition hover:text-white"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label
                      className={`${inputClass} mt-1.5 flex cursor-pointer items-center justify-center text-[var(--brand-muted)] ${
                        evidenceBusy ? "opacity-60" : "hover:border-[var(--brand-gold)]"
                      }`}
                    >
                      {evidenceBusy ? "Processing…" : "Choose an image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={evidenceBusy}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = ""; // allow re-selecting the same file
                          if (!file) return;
                          setEvidenceBusy(true);
                          setError("");
                          try {
                            const compressed = await compressImage(file);
                            if (compressed.length > 700_000) {
                              setError("That image is too large even after compression. Try a smaller one.");
                            } else {
                              setForm((f) => ({ ...f, sampleEvidence: compressed }));
                            }
                          } catch (err) {
                            setError((err as Error).message);
                          } finally {
                            setEvidenceBusy(false);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                <div className="rounded-xl border border-[var(--brand-gold)]/25 bg-[var(--brand-gold)]/[0.07] px-3.5 py-3">
                  <div className="flex items-center justify-between text-sm text-[var(--brand-muted)]">
                    <span>
                      Reward pool
                      <span className="text-[0.7rem]">
                        {reward > 0 && slots > 0 ? ` (${reward.toLocaleString()} × ${slots})` : ""}
                      </span>
                    </span>
                    <span className="text-white">{pool != null ? `${pool.toLocaleString()} NIM` : "—"}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-[var(--brand-muted)]">
                    <span>Platform fee ({config.feePercent}%)</span>
                    <span className="text-white">
                      {platformFee != null ? `${platformFee.toLocaleString()} NIM` : "—"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                      Total charged
                    </span>
                    <span className="text-lg font-bold text-[var(--brand-gold)]">
                      {totalCost != null ? `${totalCost.toLocaleString()} NIM` : "—"}
                    </span>
                  </div>
                </div>
                <p className="text-[0.7rem] text-[var(--brand-muted)]">
                  Charged from your wallet balance when you publish.
                </p>

                <button
                  type="submit"
                  disabled={submitting || evidenceBusy}
                  className={`${primaryBtn} w-full`}
                >
                  {submitting ? "Saving…" : "Continue"}
                </button>
              </div>
                </form>
              )}

              {tab === "quests" &&
                (analyticsFor ? (
                  analyticsData ? (
                    <AnalyticsDetail analytics={analyticsData} onBack={closeAnalytics} />
                  ) : (
                    <AnalyticsSkeleton title={analyticsFor.title} onBack={closeAnalytics} />
                  )
                ) : (
                  <QuestsPanel
                    quests={quests}
                    publishingId={publishingId}
                    sharedId={sharedId}
                    promotingId={promotingId}
                    promotion={config}
                    onPublish={requestPublish}
                    onShare={shareQuest}
                    onViewAnalytics={openAnalytics}
                    onPromote={promoteQuest}
                  />
                ))}

              {tab === "wallet" && (
                <WalletTab
                  balance={balance}
                  api={api}
                  onRequestFaucet={() => {
                    setNotice("");
                    setFaucetOpen(true);
                  }}
                />
              )}
            </div>

            <TabBar
              active={tab}
              onChange={(next) => {
                closeAnalytics();
                setTab(next);
              }}
            />
          </>
        )}
      </main>
    </>
  );
}

const primaryBtn =
  "inline-flex items-center justify-center rounded-full bg-[var(--brand-gold)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-gold-600)] disabled:opacity-60";

/* --------------------------------- tab bar -------------------------------- */

const TAB_ICON: Record<TabKey, React.ReactNode> = {
  home: (
    <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />
  ),
  create: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  quests: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16 12h.01M3 9h18" />
    </>
  ),
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "create", label: "Create" },
  { key: "quests", label: "Quests" },
  { key: "wallet", label: "Wallet" },
];

// Per-tab page header (home has its own personalised greeting, so it's omitted here).
const TAB_META: Partial<Record<TabKey, { title: string; subtitle: string }>> = {
  create: { title: "Create a quest", subtitle: "Draft a paid task for the community." },
  quests: { title: "Your quests", subtitle: "Publish, share, and track performance." },
  wallet: { title: "Wallet", subtitle: "The balance that funds your quests." },
};

// Fixed bottom navigation — the single surface for the whole Creator Studio Mini App.
function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[var(--brand-navy-900)]/95 pb-3 backdrop-blur"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium transition ${
                isActive ? "text-[var(--brand-gold)]" : "text-[var(--brand-muted)] hover:text-white"
              }`}
            >
              <span
                className={`absolute inset-x-5 top-0 h-0.5 rounded-full bg-[var(--brand-gold)] transition-opacity ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                {TAB_ICON[t.key]}
              </svg>
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// Wallet tab — the creator's custodial wallet that funds their quests. This is the one place
// the full address is shown (deposit here to top up), with a tap-to-copy.
interface WalletTx {
  hash: string;
  direction: "in" | "out";
  amountNim: number;
  timestamp: number | null;
  explorerUrl: string;
}

function WalletTab({
  balance,
  api,
  onRequestFaucet,
}: {
  balance: { nim: number | null; reachable: boolean; address: string | null };
  api: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onRequestFaucet: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [txs, setTxs] = useState<WalletTx[] | null>(null); // null = loading
  const [txSupported, setTxSupported] = useState(true);
  const known = balance.reachable && balance.nim !== null;
  const isTestnet = process.env.NEXT_PUBLIC_HUB_URL?.includes("testnet");

  useEffect(() => {
    let active = true;
    api("/api/studio/transactions")
      .then((body) => {
        if (!active) return;
        const b = body as { supported?: boolean; transactions?: WalletTx[] };
        setTxSupported(Boolean(b.supported));
        setTxs(b.transactions ?? []);
      })
      .catch(() => {
        if (!active) return;
        setTxSupported(false);
        setTxs([]);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const copy = async () => {
    if (!balance.address) return;
    try {
      await navigator.clipboard.writeText(balance.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — no-op.
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-6 text-center">
        <p className="eyebrow">Available balance</p>
        {known ? (
          <p className="mt-2 text-4xl font-bold tracking-tight">
            <span className="text-gradient-gold">{balance.nim!.toLocaleString()}</span>
            <span className="ml-2 text-lg font-semibold text-[var(--brand-muted)]">NIM</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--brand-muted)]">Couldn&apos;t load balance</p>
        )}
        {isTestnet && (
          <button type="button" onClick={onRequestFaucet} className={`${primaryBtn} mt-5 w-full`}>
            Get free testnet NIM
          </button>
        )}
      </div>

      {balance.address && (
        <div className="glass rounded-2xl p-5">
          <p className="eyebrow">Deposit address</p>
          <p className="mt-2 break-all rounded-xl bg-black/20 px-3.5 py-3 font-mono text-sm text-white">
            {balance.address}
          </p>
          <button onClick={() => void copy()} className={`${primaryBtn} mt-3 w-full`}>
            {copied ? "Copied" : "Copy address"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-[var(--brand-muted)]">
            Send NIM to this address to fund your quests. Publishing a quest charges its reward
            pool from this balance.
          </p>
        </div>
      )}

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Transaction history</p>
          <span className="text-[0.7rem] text-[var(--brand-muted)]">on-chain · verifiable</span>
        </div>

        {txs === null ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-white/10" />
            ))}
          </div>
        ) : !txSupported ? (
          <p className="mt-3 text-sm text-[var(--brand-muted)]">
            Transaction history isn&apos;t available right now.
          </p>
        ) : txs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--brand-muted)]">No transactions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {txs.map((t) => (
              <li key={t.hash} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {t.direction === "in" ? "Received" : "Sent"}
                  </p>
                  <a
                    href={t.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-[var(--brand-muted)] transition hover:text-[var(--brand-gold)]"
                  >
                    {t.hash.slice(0, 8)}…{t.hash.slice(-6)}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3 w-3" aria-hidden>
                      <path d="M14 5h5v5M19 5l-9 9M12 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-bold ${
                      t.direction === "in" ? "text-emerald-400" : "text-white"
                    }`}
                  >
                    {t.direction === "in" ? "+" : "−"}
                    {t.amountNim.toLocaleString()} NIM
                  </p>
                  {t.timestamp && (
                    <p className="text-[0.7rem] text-[var(--brand-muted)]">
                      {new Date(t.timestamp).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Header({ onRefresh, refreshing }: { onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/logo.png" alt="NimiqEarn Quest" width={28} height={30} className="rounded-md" />
      <div>
        <p className="text-sm font-bold leading-tight tracking-tight text-white">
          Nimiq<span className="text-[var(--brand-gold)]">Earn</span> Quest
        </p>
        <p className="eyebrow leading-tight">Creator Studio</p>
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[var(--brand-muted)] transition hover:bg-white/5 disabled:opacity-50"
        >
          <IconRefresh className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>
  );
}

function IconRefresh({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

/** Loading placeholder that mirrors the ready layout (stat row + form) to avoid a content jump. */
function StudioSkeleton() {
  return (
    <div className="mt-4 space-y-5" aria-busy="true" aria-label="Loading Creator Studio">
      <div>
        <Shimmer className="h-4 w-40" />
        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-xl px-3 py-2.5">
              <Shimmer className="mx-auto h-6 w-8" />
              <Shimmer className="mx-auto mt-2 h-2.5 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
        <Shimmer className="h-5 w-32" />
        <Shimmer className="mt-2 h-3 w-48" />
        <div className="mt-4 space-y-3.5">
          <Shimmer className="h-11 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Shimmer className="h-11 w-full" />
            <Shimmer className="h-11 w-full" />
          </div>
          <Shimmer className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Shimmer className="h-11 w-full" />
            <Shimmer className="h-11 w-full" />
          </div>
          <Shimmer className="h-11 w-full" />
          <Shimmer className="mt-1 h-11 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/6 ${className}`} />;
}

function Spinner() {
  return (
    <span
      className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-[var(--brand-gold)]"
      aria-hidden
    />
  );
}

/** Full-screen blocking overlay shown while a studio write (save / publish / register) runs. */
function LoadingOverlay({ label }: { label: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="glass flex items-center gap-3 rounded-2xl px-5 py-4">
        <Spinner />
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
    </div>
  );
}

/**
 * Publish confirmation. Pre-checks the creator's on-chain balance against the quest's reward
 * pool and blocks the Publish button when it's short — before any request is made. When the
 * balance can't be read (RPC down), it lets the user proceed and the server enforces funding.
 */
// After the create form, ask whether to publish now (funds it) or just save a draft.
function CreateConfirmModal({
  payload,
  feePercent,
  balance,
  onCancel,
  onDraft,
  onPublish,
}: {
  payload: Record<string, unknown>;
  feePercent: number;
  balance: { nim: number | null; reachable: boolean };
  onCancel: () => void;
  onDraft: () => void;
  onPublish: () => void;
}) {
  const reward = Number(payload.rewardAmount) || 0;
  const slots = Number(payload.totalSlots) || 0;
  const pool = reward * slots;
  const fee = Math.round(pool * (feePercent / 100));
  const total = pool + fee;
  const known = balance.reachable && balance.nim !== null;
  const insufficient = known && (balance.nim ?? 0) < total;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div className="glass w-full max-w-sm rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-white">Publish this quest?</h2>
        <p className="mt-1 text-sm text-[var(--brand-muted)]">
          <span className="text-white">{String(payload.title)}</span>
        </p>

        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-[var(--brand-muted)]">Reward pool</dt>
            <dd className="text-white">{pool.toLocaleString()} NIM</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--brand-muted)]">Platform fee ({feePercent}%)</dt>
            <dd className="text-white">{fee.toLocaleString()} NIM</dd>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
            <dt className="text-[var(--brand-muted)]">Charged to publish</dt>
            <dd className="font-bold text-[var(--brand-gold)]">{total.toLocaleString()} NIM</dd>
          </div>
        </dl>

        {insufficient && (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
            Not enough balance to publish now — save it as a draft and top up, then publish.
          </p>
        )}

        <button
          onClick={onPublish}
          disabled={insufficient}
          className={`${primaryBtn} mt-4 w-full disabled:opacity-50`}
        >
          Publish now
        </button>
        <button
          onClick={onDraft}
          className="mt-2 w-full rounded-full border border-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
        >
          Save as draft
        </button>
        <button
          onClick={onCancel}
          className="mt-2 w-full py-1.5 text-sm font-semibold text-[var(--brand-muted)] transition hover:text-white"
        >
          Keep editing
        </button>
      </div>
    </div>
  );
}

function PublishConfirmModal({
  quest,
  balance,
  onCancel,
  onConfirm,
}: {
  quest: Quest;
  balance: { nim: number | null; reachable: boolean };
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cost = Number(quest.rewardAmount) * quest.totalSlots;
  const known = balance.reachable && balance.nim !== null;
  const bal = balance.nim ?? 0;
  const insufficient = known && bal < cost;
  const shortfall = Math.max(0, cost - bal);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="glass w-full max-w-sm rounded-2xl p-5">
        <h3 className="text-base font-bold text-white">Publish this quest?</h3>
        <p className="mt-1 truncate text-sm text-[var(--brand-muted)]">{quest.title}</p>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-[var(--brand-muted)]">Reward pool</dt>
            <dd className="font-semibold text-white">{cost.toLocaleString()} NIM</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--brand-muted)]">Your balance</dt>
            <dd className={`font-semibold ${insufficient ? "text-red-400" : "text-white"}`}>
              {known ? `${bal.toLocaleString()} NIM` : "—"}
            </dd>
          </div>
        </dl>

        {insufficient ? (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
            Insufficient balance — you need {shortfall.toLocaleString()} more NIM. Deposit to your
            wallet in the bot, then try again.
          </p>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-[var(--brand-muted)]">
            {cost.toLocaleString()} NIM will be moved from your wallet to fund this quest.
            {!known && " We couldn't confirm your balance — publishing will fail if it's too low."}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Cancel
          </button>
          <button onClick={onConfirm} disabled={insufficient} className={`${primaryBtn} flex-1`}>
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div className="glass mt-4 rounded-2xl p-6 text-center">
      <p className={`text-sm ${tone === "error" ? "text-red-400" : "text-[var(--brand-muted)]"}`}>
        {children}
      </p>
    </div>
  );
}

function StatRow({ dashboard }: { dashboard: Dashboard }) {
  const stats = [
    { label: "Drafts", value: dashboard.quests.DRAFT },
    { label: "Published", value: dashboard.quests.PUBLISHED },
    { label: "Total", value: dashboard.quests.total },
  ];
  return (
    <div>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-1 text-2xl font-bold text-white">
        {dashboard.user.displayName ?? "Creator"}
      </h1>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl px-3 py-3 text-center">
            <p className="text-2xl font-bold tracking-tight text-white">{s.value}</p>
            <p className="mt-0.5 text-[0.68rem] uppercase tracking-wide text-[var(--brand-muted)]">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Creator's on-chain wallet balance, surfaced up front so they know their funding
// headroom before drafting — the publish modal re-checks it against the reward.
function WalletCard({
  balance,
  onRequestFaucet,
}: {
  balance: { nim: number | null; reachable: boolean };
  onRequestFaucet: () => void;
}) {
  const known = balance.reachable && balance.nim !== null;
  const isTestnet = process.env.NEXT_PUBLIC_HUB_URL?.includes("testnet");

  return (
    <div className="glass flex flex-col justify-between rounded-2xl px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow flex items-center gap-2">
            Wallet balance
            {isTestnet && (
              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-blue-400">
                TESTNET
              </span>
            )}
          </p>
          {known ? (
            <p className="mt-1 text-xl font-bold text-white">
              {balance.nim!.toLocaleString()}{" "}
              <span className="text-sm font-semibold text-[var(--brand-muted)]">NIM</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--brand-muted)]">Couldn&apos;t load balance</p>
          )}
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-[var(--brand-muted)]"
          aria-hidden
        >
          <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M16 12h.01M3 9h18" />
        </svg>
      </div>
      {isTestnet && (
        <button
          onClick={onRequestFaucet}
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--brand-gold)]/25 bg-[var(--brand-gold)]/10 px-3.5 py-3 text-left transition hover:bg-[var(--brand-gold)]/15 active:scale-[0.99]"
        >
          <div>
            <p className="text-sm font-semibold text-[var(--brand-gold)]">Get free testnet NIM</p>
            <p className="mt-0.5 text-xs text-[var(--brand-muted)]">Instant top-up · up to $1,000 / wallet</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-gold)] text-[var(--brand-ink)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}

interface FaucetQuote {
  dripNim: number;
  maxUsd: number;
  nimUsdPrice: number | null;
  balanceNim: number | null;
  balanceUsd: number | null;
  remainingUsd: number | null;
  remainingNim: number | null;
  amountNim: number;
  amountUsd: number | null;
  canRequest: boolean;
  capped: boolean;
  reachable: boolean;
}

function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) > 0 && Math.abs(n) < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Bottom-sheet faucet flow: load quote → confirm drip → brief success.
 * Owns its own request lifecycle so the sheet can animate states cleanly.
 */
function FaucetModal({
  api,
  onClose,
  onSuccess,
}: {
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [quote, setQuote] = useState<FaucetQuote | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "sending" | "done" | "error">("loading");
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ nim: number; usd: number | null } | null>(null);

  const loadQuote = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const q = (await api("/api/studio/faucet")) as FaucetQuote;
      setQuote(q);
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message || "Couldn't load faucet details.");
      setPhase("error");
    }
  }, [api]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "sending" && phase !== "done") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  useEffect(() => {
    if (phase !== "done" || !sent) return;
    const t = window.setTimeout(() => {
      const usd = sent.usd != null ? ` (~${formatUsd(sent.usd)})` : "";
      onSuccess(`${sent.nim.toLocaleString()} NIM${usd} is on the way.`);
    }, 1100);
    return () => window.clearTimeout(t);
  }, [phase, sent, onSuccess]);

  const request = async () => {
    if (!quote?.canRequest || phase === "sending") return;
    setPhase("sending");
    setError("");
    try {
      const result = (await api("/api/studio/faucet", { method: "POST" })) as {
        amountNim?: number;
        amountUsd?: number | null;
      };
      setSent({
        nim: result.amountNim ?? quote.amountNim,
        usd: result.amountUsd ?? quote.amountUsd,
      });
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("ready");
    }
  };

  const usedPct =
    quote?.balanceUsd != null && quote.maxUsd > 0
      ? Math.min(100, Math.max(0, (quote.balanceUsd / quote.maxUsd) * 100))
      : 0;
  const canSend = phase === "ready" && Boolean(quote?.canRequest);
  const dismissable = phase !== "sending" && phase !== "done";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center sm:px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="faucet-title"
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className="glass animate-slide-up w-full max-w-sm rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />

        {phase === "done" && sent ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-7 w-7" aria-hidden>
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 id="faucet-title" className="mt-4 text-lg font-bold text-white">
              Sent!
            </h3>
            <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--brand-gold)]">
              +{sent.nim.toLocaleString()}{" "}
              <span className="text-base font-semibold text-[var(--brand-muted)]">NIM</span>
            </p>
            {sent.usd != null && (
              <p className="mt-1 text-sm text-[var(--brand-muted)]">≈ {formatUsd(sent.usd)}</p>
            )}
            <p className="mt-3 text-xs text-[var(--brand-muted)]">Arriving on-chain in a few seconds…</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  Testnet faucet
                </p>
                <h3 id="faucet-title" className="mt-1 text-lg font-bold text-white">
                  Top up your wallet
                </h3>
              </div>
              {dismissable && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--brand-muted)] transition hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {phase === "loading" && (
              <div className="mt-5 space-y-4" aria-busy="true" aria-label="Loading faucet quote">
                <div className="rounded-2xl bg-black/25 px-4 py-5 text-center">
                  <div className="mx-auto h-3 w-20 animate-pulse rounded bg-white/10" />
                  <div className="mx-auto mt-3 h-9 w-36 animate-pulse rounded-lg bg-white/10" />
                  <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-white/10" />
                </div>
                <div className="h-2 animate-pulse rounded-full bg-white/10" />
                <div className="h-11 animate-pulse rounded-full bg-white/10" />
              </div>
            )}

            {phase === "error" && (
              <div className="mt-5 space-y-4">
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
                  {error}
                </p>
                <button type="button" onClick={() => void loadQuote()} className={`${primaryBtn} w-full`}>
                  Try again
                </button>
              </div>
            )}

            {quote && (phase === "ready" || phase === "sending") && (
              <>
                <div className="mt-5 rounded-2xl border border-white/8 bg-black/25 px-4 py-5 text-center">
                  <p className="text-xs font-medium text-[var(--brand-muted)]">You&apos;ll receive</p>
                  <p className="mt-1 text-4xl font-bold tracking-tight text-white">
                    <span className="text-gradient-gold">{quote.amountNim.toLocaleString()}</span>
                    <span className="ml-1.5 text-base font-semibold text-[var(--brand-muted)]">NIM</span>
                  </p>
                  <p className="mt-1 text-sm text-[var(--brand-muted)]">
                    ≈ {formatUsd(quote.amountUsd)}
                  </p>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--brand-muted)]">Faucet allowance</span>
                    <span className="font-medium text-white">
                      {formatUsd(quote.balanceUsd)} / {formatUsd(quote.maxUsd)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        quote.capped ? "bg-amber-400" : "bg-[var(--brand-gold)]"
                      }`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[var(--brand-muted)]">
                    {quote.capped
                      ? "This wallet has hit the $1,000 cap."
                      : `${formatUsd(quote.remainingUsd)} left before the per-wallet cap.`}
                  </p>
                </div>

                {error && (
                  <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void request()}
                  disabled={!canSend}
                  className={`${primaryBtn} mt-5 w-full gap-2 disabled:opacity-50`}
                >
                  {phase === "sending" ? (
                    <>
                      <Spinner />
                      Sending…
                    </>
                  ) : quote.capped ? (
                    "Cap reached"
                  ) : quote.canRequest ? (
                    `Receive ${quote.amountNim.toLocaleString()} NIM`
                  ) : (
                    "Unavailable"
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={phase === "sending"}
                  className="mt-2 w-full py-2 text-sm font-semibold text-[var(--brand-muted)] transition hover:text-white disabled:opacity-50"
                >
                  Not now
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type QuestFilter = { status: "all" | "PUBLISHED" | "DRAFT" | "CLOSED"; promotedOnly: boolean };
const QUEST_PAGE_SIZE = 6;

interface QuestListProps {
  quests: Quest[];
  publishingId: string | null;
  sharedId: string | null;
  promotingId: string | null;
  promotion: { promotionAvailable: boolean; promotionFeeNim: number };
  onPublish: (quest: Quest) => void;
  onShare: (id: string) => void;
  onViewAnalytics: (quest: Quest) => void;
  onPromote: (id: string) => void;
}

// The Quests tab: filter toolbar + paginated quest cards (each with its OG-card preview).
function QuestsPanel(props: QuestListProps) {
  const [filter, setFilter] = useState<QuestFilter>({ status: "all", promotedOnly: false });
  const [page, setPage] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = props.quests.filter((q) => {
    if (filter.status !== "all" && q.status !== filter.status) return false;
    if (filter.promotedOnly && !q.promoted) return false;
    return true;
  });
  const activeFilters = (filter.status !== "all" ? 1 : 0) + (filter.promotedOnly ? 1 : 0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / QUEST_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * QUEST_PAGE_SIZE, safePage * QUEST_PAGE_SIZE + QUEST_PAGE_SIZE);

  if (props.quests.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <p className="text-sm font-semibold text-white">No quests yet</p>
        <p className="mt-1 text-sm text-[var(--brand-muted)]">
          Head to the Create tab to draft your first quest.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--brand-muted)]">
          {filtered.length} {filtered.length === 1 ? "quest" : "quests"}
        </p>
        <button
          onClick={() => setFilterOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:border-white/25"
        >
          <FilterIcon />
          Filter
          {activeFilters > 0 && (
            <span className="rounded-full bg-[var(--brand-gold)] px-1.5 text-[0.65rem] font-bold text-[var(--brand-ink)]">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-sm text-[var(--brand-muted)]">
          No quests match these filters.
        </div>
      ) : (
        <>
          <QuestList {...props} quests={pageItems} />
          {pageCount > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                className="rounded-full border border-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-sm text-[var(--brand-muted)]">
                Page {safePage + 1} of {pageCount}
              </span>
              <button
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                className="rounded-full border border-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {filterOpen && (
        <FilterModal
          filter={filter}
          onApply={(f) => {
            setFilter(f);
            setPage(0);
            setFilterOpen(false);
          }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M4 5h16M7 12h10M10 19h4" />
    </svg>
  );
}

function FilterModal({
  filter,
  onApply,
  onClose,
}: {
  filter: QuestFilter;
  onApply: (f: QuestFilter) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<QuestFilter>(filter);
  const statuses: { value: QuestFilter["status"]; label: string }[] = [
    { value: "all", label: "All" },
    { value: "PUBLISHED", label: "Published" },
    { value: "DRAFT", label: "Draft" },
    { value: "CLOSED", label: "Closed" },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:px-5"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-sm rounded-t-2xl p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-white">Filter quests</h2>

        <p className="eyebrow mt-4">Status</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {statuses.map((s) => {
            const on = draft.status === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setDraft({ ...draft, status: s.value })}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  on
                    ? "bg-[var(--brand-gold)] text-[var(--brand-ink)]"
                    : "border border-white/10 text-white hover:border-white/25"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <label className="mt-5 flex cursor-pointer items-center justify-between">
          <span className="text-sm font-semibold text-white">Promoted only</span>
          <input
            type="checkbox"
            checked={draft.promotedOnly}
            onChange={(e) => setDraft({ ...draft, promotedOnly: e.target.checked })}
            className="h-5 w-5 accent-[var(--brand-gold)]"
          />
        </label>

        <button onClick={() => onApply(draft)} className={`${primaryBtn} mt-5 w-full`}>
          Apply
        </button>
        <button
          onClick={() => onApply({ status: "all", promotedOnly: false })}
          className="mt-2 w-full py-1.5 text-sm font-semibold text-[var(--brand-muted)] transition hover:text-white"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}

function QuestList({
  quests,
  publishingId,
  sharedId,
  promotingId,
  promotion,
  onPublish,
  onShare,
  onViewAnalytics,
  onPromote,
}: QuestListProps) {
  return (
    <div className="space-y-2.5">
      {quests.map((q) => {
        return (
          <div
            key={q.id}
            className={`glass overflow-hidden rounded-xl ${q.promoted ? "border-[var(--brand-gold)]/40" : ""}`}
          >
            {q.status !== "DRAFT" && (
              // The shareable OG card (non-counting thumbnail) — a visual preview of the quest.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/q/${q.id}/opengraph-image`}
                alt=""
                loading="lazy"
                className="aspect-[1200/630] w-full border-b border-white/10 object-cover"
              />
            )}
            <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-semibold text-white">{q.title}</p>
              <div className="flex shrink-0 items-center gap-1.5">
                {q.promoted && <Tag label="Promoted" gold />}
                {q.scheduled && <Tag label="Scheduled" />}
                <StatusBadge status={q.status} />
              </div>
            </div>

            {q.scheduled && q.startAt && (
              <p className="mt-1.5 text-xs text-[var(--brand-muted)]">
                Starts {new Date(q.startAt).toLocaleString()}
              </p>
            )}

            <div className="mt-2.5 grid grid-cols-4 gap-2">
              <Metric label="Views" value={q.viewCount.toLocaleString()} />
              <Metric label="Reward" value={Number(q.rewardAmount).toLocaleString()} />
              <Metric label="Slots" value={`${q.filledSlots}/${q.totalSlots}`} />
              <Metric label="Pool" value={(Number(q.rewardAmount) * q.totalSlots).toLocaleString()} />
            </div>

            {q.status === "DRAFT" && (
              <button
                onClick={() => onPublish(q)}
                disabled={publishingId === q.id}
                className={`${primaryBtn} mt-3 w-full`}
              >
                {publishingId === q.id ? "Publishing…" : "Publish"}
              </button>
            )}

            {q.status === "PUBLISHED" && (
              <button
                onClick={() => onShare(q.id)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--brand-gold)]/40 px-4 py-2 text-sm font-semibold text-[var(--brand-gold)] transition hover:bg-[var(--brand-gold)]/10"
              >
                {sharedId === q.id ? "Link copied" : "Share quest link"}
              </button>
            )}

            {q.status === "PUBLISHED" && !q.promoted && promotion.promotionAvailable && (
              <button
                onClick={() => onPromote(q.id)}
                disabled={promotingId === q.id}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--brand-gold)]/40 px-4 py-2 text-sm font-semibold text-[var(--brand-gold)] transition hover:bg-[var(--brand-gold)]/10 disabled:opacity-60"
              >
                {promotingId === q.id
                  ? "Promoting…"
                  : `Promote — ${promotion.promotionFeeNim.toLocaleString()} NIM`}
              </button>
            )}

            {q.status !== "DRAFT" && (
              <button
                onClick={() => onViewAnalytics(q)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/25"
              >
                View analytics
              </button>
            )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tag({ label, gold }: { label: string; gold?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${
        gold ? "bg-[var(--brand-gold)]/20 text-[var(--brand-gold)]" : "bg-white/10 text-[var(--brand-muted)]"
      }`}
    >
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-center">
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[0.6rem] uppercase tracking-wide text-[var(--brand-muted)]">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: Quest["status"] }) {
  const styles: Record<Quest["status"], string> = {
    DRAFT: "bg-white/10 text-[var(--brand-muted)]",
    PUBLISHED: "bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]",
    CLOSED: "bg-white/10 text-[var(--brand-muted)]",
    ARCHIVED: "bg-white/10 text-[var(--brand-muted)]",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {status.toLowerCase()}
    </span>
  );
}

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: string;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
