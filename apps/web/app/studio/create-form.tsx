"use client";

import { type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import type { QuestForm, StudioBalance } from "./types";
import {
  CATEGORIES,
  CATEGORY_DEFAULTS,
  emptyForm,
  emptyProofRules,
  PROOF_TYPES,
  QUEST_TEMPLATES,
} from "./constants";
import { inputClass, labelClass, primaryBtn } from "./styles";
import { compressImage } from "./utils";

function CreateSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[0.95rem] font-semibold tracking-tight text-white">{title}</h2>
        {hint ? (
          <p className="mt-0.5 text-[0.7rem] leading-relaxed text-[var(--brand-muted)]">{hint}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className={labelClass}>{label}</label>
        {hint ? <span className="text-[0.65rem] text-[var(--brand-muted)]">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function completeness(form: QuestForm) {
  const checks = [
    form.title.trim().length >= 3,
    form.description.trim().length >= 10,
    Boolean(form.proofType),
    form.proofInstructions.trim().length >= 5,
    Number(form.rewardAmount) > 0,
    Number.isInteger(Number(form.totalSlots)) && Number(form.totalSlots) > 0,
  ];
  const done = checks.filter(Boolean).length;
  return { done, total: checks.length, ready: done === checks.length };
}

export type CreateQuestFormProps = {
  form: QuestForm;
  setForm: Dispatch<SetStateAction<QuestForm>>;
  templateId: string | null;
  setTemplateId: Dispatch<SetStateAction<string | null>>;
  createStage: "pick" | "edit";
  setCreateStage: Dispatch<SetStateAction<"pick" | "edit">>;
  pool: number | null;
  platformFee: number | null;
  totalCost: number | null;
  reward: number;
  slots: number;
  minStart: string;
  config: { feePercent: number };
  balance: Pick<StudioBalance, "nim" | "reachable">;
  evidenceBusy: boolean;
  setEvidenceBusy: Dispatch<SetStateAction<boolean>>;
  submitting: boolean;
  setError: Dispatch<SetStateAction<string>>;
  onSubmit: (e: FormEvent) => void;
};

export function CreateQuestForm({
  form,
  setForm,
  templateId,
  setTemplateId,
  createStage,
  setCreateStage,
  pool,
  platformFee,
  totalCost,
  reward,
  slots,
  minStart,
  config,
  balance,
  evidenceBusy,
  setEvidenceBusy,
  submitting,
  setError,
  onSubmit,
}: CreateQuestFormProps) {
  const patch = (next: Partial<QuestForm>) => setForm((f) => ({ ...f, ...next }));
  const progress = completeness(form);
  const proofMeta = PROOF_TYPES.find((p) => p.value === form.proofType);
  const categoryLabel =
    CATEGORIES.find((c) => c.value === form.category)?.label ?? form.category;
  const underfunded =
    balance.nim != null && totalCost != null && balance.nim < totalCost;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {createStage === "pick" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {QUEST_TEMPLATES.map((t) => {
              const proofLabel =
                PROOF_TYPES.find((p) => p.value === t.proofType)?.label ?? t.proofType;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTemplateId(t.id);
                    setForm({
                      ...emptyForm,
                      category: t.category,
                      proofType: t.proofType,
                      title: t.title,
                      description: t.description,
                      proofInstructions: t.proofInstructions,
                      rewardAmount: t.rewardAmount,
                      totalSlots: t.totalSlots,
                    });
                    setCreateStage("edit");
                  }}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[var(--brand-navy-800)]/70 px-4 py-3.5 text-left transition hover:border-[var(--brand-gold)]/35 hover:bg-[var(--brand-navy-800)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{t.label}</p>
                    <p className="mt-0.5 text-[0.7rem] leading-snug text-[var(--brand-muted)]">
                      {t.blurb}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[var(--brand-gold)]">
                      {Number(t.rewardAmount).toLocaleString()}
                      <span className="ml-0.5 text-[0.65rem] font-medium text-[var(--brand-muted)]">
                        NIM
                      </span>
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-[var(--brand-muted)]">
                      {proofLabel}
                    </p>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-4 w-4 shrink-0 text-[var(--brand-muted)] transition group-hover:text-[var(--brand-gold)]"
                    aria-hidden
                  >
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setTemplateId(null);
              setForm(emptyForm);
              setCreateStage("edit");
            }}
            className="w-full rounded-2xl border border-dashed border-white/15 px-4 py-3.5 text-sm font-medium text-[var(--brand-muted)] transition hover:border-white/30 hover:text-white"
          >
            Start from scratch
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCreateStage("pick")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-muted)] transition hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Templates
            </button>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-medium text-[var(--brand-muted)]">
              {templateId
                ? (QUEST_TEMPLATES.find((t) => t.id === templateId)?.label ?? "Template")
                : "Custom"}
            </span>
          </div>

          {/* Progress */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-white">
                {progress.ready ? "Ready to review" : "Complete the required fields"}
              </p>
              <p className="text-[0.65rem] tabular-nums text-[var(--brand-muted)]">
                {progress.done}/{progress.total}
              </p>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--brand-gold)] transition-all duration-300"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>

          <div className="glass space-y-5 rounded-2xl p-5">
            <CreateSection title="What workers see" hint="Clear title and numbered steps convert better.">
              <Field label="Title" hint={`${form.title.length}/100`}>
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  maxLength={100}
                  placeholder="What should they do?"
                  required
                />
              </Field>

              <Field label="Category">
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => {
                    const active = form.category === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                          const defaults = CATEGORY_DEFAULTS[c.value];
                          setForm((f) => ({
                            ...f,
                            category: c.value,
                            ...(defaults
                              ? {
                                  proofType: defaults.proofType,
                                  ...emptyProofRules,
                                  ...(f.proofInstructions.trim()
                                    ? {}
                                    : { proofInstructions: defaults.proofHint }),
                                }
                              : {}),
                          }));
                        }}
                        className={`rounded-full px-2.5 py-1 text-[0.7rem] font-medium transition ${
                          active
                            ? "bg-white/12 text-white ring-1 ring-white/20"
                            : "text-[var(--brand-muted)] hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Instructions">
                <textarea
                  className={`${inputClass} min-h-[112px] resize-y`}
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  minLength={10}
                  maxLength={2000}
                  placeholder={"1. Do this\n2. Then that\n3. Submit proof"}
                  required
                />
              </Field>
            </CreateSection>

            <div className="border-t border-white/10" />

            <CreateSection
              title="How they prove it"
              hint={proofMeta ? `${proofMeta.label} · ${proofMeta.hint}` : "Pick one format."}
            >
              <div className="grid grid-cols-2 gap-2">
                {PROOF_TYPES.map((p) => {
                  const active = form.proofType === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          proofType: p.value,
                          ...emptyProofRules,
                        }))
                      }
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-[var(--brand-gold)] bg-[var(--brand-gold)]/10"
                          : "border-white/10 bg-[var(--brand-navy-800)]/50 hover:border-white/20"
                      }`}
                    >
                      <span className="block text-xs font-semibold text-white">{p.label}</span>
                      <span className="mt-0.5 block text-[0.65rem] text-[var(--brand-muted)]">
                        {p.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              <Field label="Submission guidance">
                <textarea
                  className={`${inputClass} min-h-[72px] resize-y`}
                  value={form.proofInstructions}
                  onChange={(e) => patch({ proofInstructions: e.target.value })}
                  minLength={5}
                  maxLength={1000}
                  placeholder="Tell them exactly what to paste or upload."
                  required
                />
              </Field>

              {/* Proof-critical rules stay visible — not buried in Advanced */}
              {form.proofType === "TRANSACTION_HASH" && (
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/15 p-3">
                  <p className="text-[0.7rem] font-medium text-[var(--brand-muted)]">
                    On-chain checks
                  </p>
                  <Field label="Pay-to address">
                    <input
                      className={inputClass}
                      value={form.targetAddress}
                      onChange={(e) => patch({ targetAddress: e.target.value })}
                      placeholder="NQ…"
                    />
                  </Field>
                  <Field label="Minimum amount">
                    <div className="relative">
                      <input
                        className={`${inputClass} pr-12`}
                        value={form.minAmountNim}
                        onChange={(e) => patch({ minAmountNim: e.target.value })}
                        inputMode="decimal"
                        placeholder="10"
                      />
                      <span className="pointer-events-none absolute bottom-2.5 right-3.5 text-xs text-[var(--brand-muted)]">
                        NIM
                      </span>
                    </div>
                  </Field>
                </div>
              )}

              {form.proofType === "LINK" && (
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-black/15 p-3 sm:grid-cols-2">
                  <Field label="Required hashtags">
                    <input
                      className={inputClass}
                      value={form.requiredHashtags}
                      onChange={(e) => patch({ requiredHashtags: e.target.value })}
                      placeholder="#nimiq #earn"
                    />
                  </Field>
                  <Field label="Required mentions">
                    <input
                      className={inputClass}
                      value={form.requiredMentions}
                      onChange={(e) => patch({ requiredMentions: e.target.value })}
                      placeholder="@nimiq"
                    />
                  </Field>
                </div>
              )}

              {(form.proofType === "SCREENSHOT" || form.proofType === "UPLOADED_MEDIA") && (
                <Field label="Live post URL" hint="Optional">
                  <input
                    className={inputClass}
                    value={form.livePostUrl}
                    onChange={(e) => patch({ livePostUrl: e.target.value })}
                    placeholder="https://x.com/…/status/…"
                  />
                </Field>
              )}

              {form.proofType === "REFERRAL_EVENT" && (
                <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-[var(--brand-muted)]">
                  <input
                    type="checkbox"
                    checked={form.requireFirstQuest}
                    onChange={(e) => patch({ requireFirstQuest: e.target.checked })}
                  />
                  Referred user must complete a first quest
                </label>
              )}
            </CreateSection>

            <div className="border-t border-white/10" />

            <CreateSection title="Budget" hint="Pool = reward × slots. Charged only on publish.">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Reward each">
                  <div className="relative">
                    <input
                      className={`${inputClass} pr-12`}
                      value={form.rewardAmount}
                      onChange={(e) => patch({ rewardAmount: e.target.value })}
                      inputMode="decimal"
                      placeholder="50"
                      required
                    />
                    <span className="pointer-events-none absolute bottom-2.5 right-3.5 text-xs text-[var(--brand-muted)]">
                      NIM
                    </span>
                  </div>
                </Field>
                <Field label="Slots">
                  <input
                    className={inputClass}
                    value={form.totalSlots}
                    onChange={(e) => patch({ totalSlots: e.target.value })}
                    inputMode="numeric"
                    placeholder="20"
                    required
                  />
                </Field>
              </div>

              <div className="rounded-xl bg-black/20 px-3.5 py-3">
                <div className="flex items-center justify-between text-[0.8rem] text-[var(--brand-muted)]">
                  <span>
                    Pool
                    {reward > 0 && slots > 0 ? (
                      <span className="text-[0.65rem]">
                        {" "}
                        ({reward.toLocaleString()} × {slots})
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-white">
                    {pool != null ? `${pool.toLocaleString()} NIM` : "—"}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[0.8rem] text-[var(--brand-muted)]">
                  <span>Platform fee ({config.feePercent}%)</span>
                  <span className="tabular-nums text-white">
                    {platformFee != null ? `${platformFee.toLocaleString()} NIM` : "—"}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2.5">
                  <span className="text-xs text-[var(--brand-muted)]">Total to publish</span>
                  <span className="text-base font-semibold tabular-nums text-[var(--brand-gold)]">
                    {totalCost != null ? `${totalCost.toLocaleString()} NIM` : "—"}
                  </span>
                </div>
              </div>

              {underfunded ? (
                <p className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[0.7rem] text-amber-200">
                  Wallet has {balance.nim!.toLocaleString()} NIM — top up before publishing
                  (drafts stay free).
                </p>
              ) : (
                <p className="text-[0.7rem] text-[var(--brand-muted)]">
                  Drafts are free. You&apos;re charged only when you publish.
                </p>
              )}
            </CreateSection>

            <div className="border-t border-white/10" />

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-white [&::-webkit-details-marker]:hidden">
                <span>More options</span>
                <span className="flex items-center gap-2">
                  <span className="text-[0.65rem] font-normal text-[var(--brand-muted)] group-open:hidden">
                    Schedule · gates · sample
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-4 w-4 text-[var(--brand-muted)] transition group-open:rotate-180"
                    aria-hidden
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </summary>
              <div className="mt-4 space-y-4">
                <Field label="Schedule start" hint="Optional">
                  <input
                    type="datetime-local"
                    className={`${inputClass} appearance-none`}
                    value={form.startAt}
                    min={minStart}
                    onChange={(e) => patch({ startAt: e.target.value })}
                  />
                  <p className="mt-1 text-[0.7rem] text-[var(--brand-muted)]">
                    Leave blank to go live as soon as you publish.
                  </p>
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Min reputation" hint="Optional">
                    <input
                      className={inputClass}
                      value={form.minReputation}
                      onChange={(e) => patch({ minReputation: e.target.value })}
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Deadline" hint="Optional">
                    <input
                      type="datetime-local"
                      className={`${inputClass} appearance-none`}
                      value={form.deadlineAt}
                      onChange={(e) => patch({ deadlineAt: e.target.value })}
                    />
                  </Field>
                </div>

                <Field label="Sample evidence" hint="Optional">
                  <p className="mt-1 text-[0.7rem] text-[var(--brand-muted)]">
                    Show an example of acceptable proof.
                  </p>
                  {form.sampleEvidence ? (
                    <div className="mt-2 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.sampleEvidence}
                        alt="Sample evidence"
                        className="h-14 w-14 rounded-lg border border-white/10 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => patch({ sampleEvidence: "" })}
                        className="text-sm font-medium text-[var(--brand-muted)] transition hover:text-white"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label
                      className={`${inputClass} mt-1.5 flex cursor-pointer items-center justify-center border-dashed text-[var(--brand-muted)] ${
                        evidenceBusy ? "opacity-60" : "hover:border-[var(--brand-gold)]/50"
                      }`}
                    >
                      {evidenceBusy ? "Processing…" : "Upload image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={evidenceBusy}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setEvidenceBusy(true);
                          setError("");
                          try {
                            const compressed = await compressImage(file);
                            if (compressed.length > 700_000) {
                              setError(
                                "That image is too large even after compression. Try a smaller one.",
                              );
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
                </Field>
              </div>
            </details>
          </div>

          {/* Single review strip: preview + cost + CTA */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[var(--brand-navy-800)]/80 p-4">
            <div>
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.08em] text-[var(--brand-muted)]">
                Worker preview
              </p>
              <p className="mt-1.5 text-sm font-semibold text-white">
                {form.title.trim() || "Untitled quest"}
              </p>
              <p className="mt-1 text-[0.7rem] text-[var(--brand-muted)]">
                {categoryLabel}
                {" · "}
                {proofMeta?.label ?? form.proofType}
                {reward > 0 ? ` · ${reward.toLocaleString()} NIM` : ""}
                {slots > 0 ? ` · ${slots} slots` : ""}
              </p>
            </div>

            <div className="flex items-end justify-between gap-3 border-t border-white/10 pt-3">
              <div>
                <p className="text-[0.65rem] text-[var(--brand-muted)]">Publish cost</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--brand-gold)]">
                  {totalCost != null ? `${totalCost.toLocaleString()} NIM` : "—"}
                </p>
              </div>
              <button
                type="submit"
                disabled={submitting || evidenceBusy || !progress.ready}
                className={`${primaryBtn} min-w-[9.5rem]`}
              >
                {submitting ? "Saving…" : "Review"}
              </button>
            </div>
            {!progress.ready ? (
              <p className="text-[0.65rem] text-[var(--brand-muted)]">
                Fill title, instructions, proof guidance, reward, and slots to continue.
              </p>
            ) : null}
          </div>
        </>
      )}
    </form>
  );
}
