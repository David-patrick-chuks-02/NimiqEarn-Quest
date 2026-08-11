"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnalyticsDetail, AnalyticsSkeleton, type Analytics } from "./_analytics";
import type { Dashboard, Phase, Quest, TabKey } from "./types";
import {
  emptyForm,
  PREVIEW_DASHBOARD,
  TAB_META,
} from "./constants";
import { primaryBtn } from "./styles";
import { isStudioPreview } from "./utils";
import { CreateQuestForm } from "./create-form";
import { TabBar } from "./tab-bar";
import {
  Header,
  Info,
  LoadingOverlay,
  StatRow,
  StudioSkeleton,
} from "./chrome";
import { FaucetModal, WalletCard, WalletTab } from "./wallet";
import { QuestsPanel, SubmissionsReviewModal } from "./quests";
import { CreateConfirmModal, PublishConfirmModal } from "./modals";

export default function StudioPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [createStage, setCreateStage] = useState<"pick" | "edit">("pick");
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
  const [reviewQuest, setReviewQuest] = useState<Quest | null>(null);
  const [faucetOpen, setFaucetOpen] = useState(false);
  const [balanceAnim, setBalanceAnim] = useState<{ from: number; to: number } | null>(null);
  const [walletTxOpen, setWalletTxOpen] = useState(false);
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

    // Retry idempotent GETs (and cold-start 502/503/504) a few times — Render free API spins down.
    const method = (init?.method ?? "GET").toUpperCase();
    const canRetry = method === "GET" || method === "HEAD";
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < (canRetry ? 4 : 1); attempt++) {
      try {
        const res = await fetch(path, { ...init, headers });
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (res.ok) return body;
        if (canRetry && (res.status === 502 || res.status === 503 || res.status === 504) && attempt < 3) {
          await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
          continue;
        }
        throw new Error((body.error as string) ?? `Request failed (${res.status})`);
      } catch (e) {
        lastErr = e as Error;
        if (canRetry && attempt < 3 && !(e instanceof Error && e.message.startsWith("Request failed"))) {
          await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
          continue;
        }
        throw e;
      }
    }
    throw lastErr ?? new Error("Request failed");
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
    (detail: { from: number; to: number }) => {
      setFaucetOpen(false);
      // Keep the stored balance at `from` while the UI counts up to `to`,
      // otherwise loadBalance / setBalance(to) jumps the number before the anim runs.
      setBalance((b) => ({ ...b, nim: detail.from, reachable: true }));
      setBalanceAnim({ from: detail.from, to: detail.to });
      window.setTimeout(() => {
        setBalance((b) => ({ ...b, nim: detail.to, reachable: true }));
        setBalanceAnim(null);
        void loadBalance();
      }, 1800);
      window.setTimeout(() => void loadBalance(), 4000);
      window.setTimeout(() => void refreshAll(), 7000);
    },
    [loadBalance, refreshAll],
  );

  // Quest/action notices auto-dismiss so they don't linger across tabs.
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(id);
  }, [notice]);

  // Keep wallet balance fresh while Creator Studio is open.
  // Pause during count-up so a refresh can't jump past the animation.
  useEffect(() => {
    if (phase !== "ready" || balanceAnim) return;
    const id = window.setInterval(() => void loadBalance(), 10_000);
    return () => window.clearInterval(id);
  }, [phase, balanceAnim, loadBalance]);

  const boot = useCallback(async () => {
    // Local UI review — never hand control to Telegram boot.
    if (isStudioPreview()) {
      setDashboard(PREVIEW_DASHBOARD);
      setBalance({
        nim: 12_500,
        reachable: true,
        address: "NQ48 VAXG JD1K YSCM X6H6 DJSL AYN7 FTYF 0KAH",
      });
      setConfig({ feePercent: 5, promotionAvailable: true, promotionFeeNim: 250 });
      setTab("create");
      setCreateStage("pick");
      setPhase("ready");
      setNotice("UI preview mode — open from the bot to create for real.");
      return;
    }

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
  // Script onLoad handler below triggers it. Preview boots without Telegram.
  useEffect(() => {
    if (isStudioPreview() || window.Telegram?.WebApp) void boot();
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
      // Only include verification fields that apply to the selected proof type.
      const verificationConfig: Record<string, unknown> = {};
      const proof = form.proofType;

      if (proof === "TRANSACTION_HASH") {
        if (form.targetAddress.trim()) verificationConfig.targetAddress = form.targetAddress.trim();
        if (form.minAmountNim.trim()) {
          const n = Number(form.minAmountNim);
          if (!Number.isFinite(n) || n <= 0) {
            setError("Min amount: enter a positive NIM amount, or leave blank.");
            return;
          }
          verificationConfig.minAmountNim = n;
        }
      }
      if (proof === "LINK") {
        if (form.requiredHashtags.trim()) {
          verificationConfig.requiredHashtags = form.requiredHashtags
            .split(/[,\s]+/)
            .map((h) => h.replace(/^#/, "").trim())
            .filter(Boolean);
        }
        if (form.requiredMentions.trim()) {
          verificationConfig.requiredMentions = form.requiredMentions
            .split(/[,\s]+/)
            .map((h) => h.replace(/^@/, "").trim())
            .filter(Boolean);
        }
      }
      if (proof === "WALLET_INTERACTION" && form.expectedMessage.trim()) {
        verificationConfig.expectedMessage = form.expectedMessage.trim();
      }
      if (
        (proof === "SCREENSHOT" || proof === "UPLOADED_MEDIA") &&
        form.livePostUrl.trim()
      ) {
        try {
          // eslint-disable-next-line no-new
          new URL(form.livePostUrl.trim());
          verificationConfig.livePostUrl = form.livePostUrl.trim();
        } catch {
          setError("Live post URL: enter a valid http(s) URL, or leave blank.");
          return;
        }
      }
      if (proof === "REFERRAL_EVENT" && form.requireFirstQuest) {
        verificationConfig.requireFirstQuest = true;
      }

      if (form.minReputation.trim()) {
        const n = Number(form.minReputation);
        if (!Number.isInteger(n) || n < 0) {
          setError("Min reputation: enter a whole number ≥ 0, or leave blank.");
          return;
        }
        verificationConfig.minReputation = n;
      }
      if (form.deadlineAt) {
        const when = new Date(form.deadlineAt);
        if (Number.isNaN(when.getTime())) {
          setError("Deadline: pick a valid date/time, or leave blank.");
          return;
        }
        verificationConfig.deadlineAt = when.toISOString();
      }

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
          ...(Object.keys(verificationConfig).length
            ? { verificationConfig }
            : {}),
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
        setTemplateId(null);
        setCreateStage("pick");
        setTab("quests");
        await Promise.all([loadQuests(), refreshDashboard(), loadBalance()]);
      } catch (e2) {
        // If the draft was created but publishing failed (e.g. low balance), it's saved —
        // send them to the Quests tab to retry publishing, with the error shown.
        setError((e2 as Error).message);
        if (createdId) {
          setForm(emptyForm);
          setTemplateId(null);
          setCreateStage("pick");
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
          initialBalance={{ nim: balance.nim, reachable: balance.reachable }}
          onClose={() => setFaucetOpen(false)}
          onSuccess={onFaucetSuccess}
        />
      )}
      {reviewQuest && (
        <SubmissionsReviewModal
          quest={reviewQuest}
          api={api}
          onClose={() => setReviewQuest(null)}
          onChanged={() => void loadQuests()}
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
              {!analyticsFor && tab === "wallet" && walletTxOpen && (
                <div>
                  <h1 className="text-2xl font-bold text-white">Transactions</h1>
                  <p className="mt-1 text-sm text-[var(--brand-muted)]">On-chain history for your wallet.</p>
                </div>
              )}
              {!analyticsFor && TAB_META[tab] && !(tab === "wallet" && walletTxOpen) && (
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    {tab === "create"
                      ? createStage === "pick"
                        ? "New quest"
                        : "Configure quest"
                      : TAB_META[tab]!.title}
                  </h1>
                  <p className="mt-1 text-sm text-[var(--brand-muted)]">
                    {tab === "create"
                      ? createStage === "pick"
                        ? "Start from a template, or build from scratch."
                        : "Edit the details workers will see, then review."
                      : TAB_META[tab]!.subtitle}
                  </p>
                </div>
              )}

              {notice && (
                <div className="flex items-start gap-2 rounded-xl border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/10 px-3.5 py-2.5">
                  <p className="flex-1 text-sm text-[var(--brand-gold)]">{notice}</p>
                  <button
                    type="button"
                    onClick={() => setNotice("")}
                    aria-label="Dismiss"
                    className="shrink-0 text-[var(--brand-gold)]/70 transition hover:text-[var(--brand-gold)]"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
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
                    balanceAnim={balanceAnim}
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
                <CreateQuestForm
                  form={form}
                  setForm={setForm}
                  templateId={templateId}
                  setTemplateId={setTemplateId}
                  createStage={createStage}
                  setCreateStage={setCreateStage}
                  pool={pool}
                  platformFee={platformFee}
                  totalCost={totalCost}
                  reward={reward}
                  slots={slots}
                  minStart={minStart}
                  config={config}
                  balance={balance}
                  evidenceBusy={evidenceBusy}
                  setEvidenceBusy={setEvidenceBusy}
                  submitting={submitting}
                  setError={setError}
                  onSubmit={submitQuest}
                />
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
                    onReview={setReviewQuest}
                  />
                ))}

              {tab === "wallet" && (
                <WalletTab
                  balance={balance}
                  balanceAnim={balanceAnim}
                  api={api}
                  onTxViewChange={setWalletTxOpen}
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

