"use client";

import { type Dispatch, type FormEvent, type SetStateAction } from "react";
import type { QuestForm } from "./types";
import { CATEGORIES, PROOF_TYPES } from "./constants";
import { Field, CreateSection } from "./create-form";
import { inputClass, primaryBtn } from "./styles";
import { compressImage } from "./utils";
import { MAX_SAMPLE_EVIDENCE_UPLOADS } from "@nimiqearn/shared/limits";

/** The money side of a published quest, shown read-only while editing content. */
export interface LockedBudget {
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
}

export type EditQuestFormProps = {
  form: QuestForm;
  setForm: Dispatch<SetStateAction<QuestForm>>;
  locked: LockedBudget;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (e: FormEvent) => void;
};

/**
 * Edit a PUBLISHED quest's content.
 *
 * Reward and slots are rendered as read-only context, never as inputs: the pool is already
 * escrowed on-chain against the original numbers, so the API rejects them (its schema is strict).
 * Everything workers actually read — title, steps, proof rules, campaign links, deadline — is
 * editable here, which is what lets a creator fix a live quest.
 */
export function EditQuestForm({
  form,
  setForm,
  locked,
  submitting,
  onCancel,
  onSubmit,
}: EditQuestFormProps) {
  const patch = (next: Partial<QuestForm>) => setForm((f) => ({ ...f, ...next }));
  const proofMeta = PROOF_TYPES.find((p) => p.value === form.proofType);

  async function addEvidence(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_SAMPLE_EVIDENCE_UPLOADS - form.sampleEvidence.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    const encoded: string[] = [];
    for (const file of picked) {
      try {
        encoded.push(await compressImage(file));
      } catch {
        // Skip an unreadable file rather than failing the whole selection.
      }
    }
    if (encoded.length) patch({ sampleEvidence: [...form.sampleEvidence, ...encoded] });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/20 px-3.5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
          Locked while the quest is live
        </p>
        <p className="mt-1 text-sm text-white">
          {Number(locked.rewardAmount).toLocaleString()} NIM × {locked.totalSlots} slots
        </p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-[var(--brand-muted)]">
          The reward pool is already funded in escrow, so the prize and slot count can&apos;t change
          after publishing. {locked.filledSlots} of {locked.totalSlots} slots are taken.
        </p>
      </div>

      <div className="glass space-y-5 rounded-2xl p-5">
        <CreateSection title="What workers see" hint="Changes go live immediately.">
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
                    onClick={() => patch({ category: c.value })}
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
          {/* Proof type is fixed after publishing: submissions already in the queue were verified
              against these rules, so switching format mid-flight would be unfair to them. */}
          <div className="rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
              Proof format (locked)
            </p>
            <p className="mt-1 text-sm text-white">
              {proofMeta ? `${proofMeta.label} — ${proofMeta.hint}` : form.proofType}
            </p>
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

          {form.proofType === "TRANSACTION_HASH" && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/15 p-3">
              <p className="text-[0.7rem] font-medium text-[var(--brand-muted)]">On-chain checks</p>
              <Field label="Pay-to address">
                <input
                  className={inputClass}
                  value={form.targetAddress}
                  onChange={(e) => patch({ targetAddress: e.target.value })}
                  placeholder="NQ…"
                />
              </Field>
              <Field label="Minimum amount">
                <input
                  className={`${inputClass} pr-12`}
                  value={form.minAmountNim}
                  onChange={(e) => patch({ minAmountNim: e.target.value })}
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>
            </div>
          )}

          {form.proofType === "LINK" && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/15 p-3">
              <p className="text-[0.7rem] font-medium text-[var(--brand-muted)]">Link checks</p>
              <Field label="Required hashtags" hint="Comma separated">
                <input
                  className={inputClass}
                  value={form.requiredHashtags}
                  onChange={(e) => patch({ requiredHashtags: e.target.value })}
                  placeholder="nimiq, earn"
                />
              </Field>
              <Field label="Required mentions" hint="Comma separated">
                <input
                  className={inputClass}
                  value={form.requiredMentions}
                  onChange={(e) => patch({ requiredMentions: e.target.value })}
                  placeholder="NimiqEarn"
                />
              </Field>
            </div>
          )}

          {(form.proofType === "SCREENSHOT" || form.proofType === "UPLOADED_MEDIA") && (
            <Field label="Live post URLs" hint={`Optional · ${form.livePostUrls.length}/3`}>
              <div className="space-y-2">
                {form.livePostUrls.map((url, i) => (
                  <div key={i} className="relative">
                    <input
                      className={`${inputClass} ${form.livePostUrls.length > 1 ? "pr-10" : ""}`}
                      value={url}
                      onChange={(e) =>
                        patch({
                          livePostUrls: form.livePostUrls.map((u, j) =>
                            j === i ? e.target.value : u,
                          ),
                        })
                      }
                      placeholder="https://x.com/…/status/…"
                    />
                    {form.livePostUrls.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remove link ${i + 1}`}
                        onClick={() =>
                          patch({
                            livePostUrls: form.livePostUrls.filter((_, j) => j !== i),
                          })
                        }
                        className="absolute bottom-2 right-2.5 rounded-lg px-2 py-1 text-xs text-[var(--brand-muted)] transition hover:text-white"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                ))}
                {form.livePostUrls.length < 3 ? (
                  <button
                    type="button"
                    onClick={() => patch({ livePostUrls: [...form.livePostUrls, ""] })}
                    className="text-xs font-medium text-[var(--brand-gold)] transition hover:opacity-80"
                  >
                    + Add another link
                  </button>
                ) : null}
              </div>
            </Field>
          )}

          {form.proofType === "REFERRAL_EVENT" && (
            <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-[var(--brand-muted)]">
              <input
                type="checkbox"
                checked={form.requireFirstQuest}
                onChange={(e) => patch({ requireFirstQuest: e.target.checked })}
              />
              Only count referrals new to NimiqEarn
            </label>
          )}
        </CreateSection>

        <div className="border-t border-white/10" />

        <CreateSection title="Limits" hint="Optional gates applied before a worker can submit.">
          <div className="grid grid-cols-2 gap-3">
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
            <div className="mt-1.5 space-y-2">
              {form.sampleEvidence.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.sampleEvidence.map((src, index) => (
                    <div key={index} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Sample evidence ${index + 1}`}
                        className="h-20 w-20 rounded-lg border border-white/10 object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Remove sample ${index + 1}`}
                        onClick={() =>
                          patch({
                            sampleEvidence: form.sampleEvidence.filter((_, i) => i !== index),
                          })
                        }
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-black/80 px-1.5 text-xs text-white ring-1 ring-white/20"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {form.sampleEvidence.length < MAX_SAMPLE_EVIDENCE_UPLOADS && (
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    void addEvidence(e.target.files);
                    e.target.value = "";
                  }}
                  className={`${inputClass} flex cursor-pointer items-center justify-center border-dashed text-[var(--brand-muted)]`}
                />
              )}
            </div>
          </Field>
        </CreateSection>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} disabled={submitting} className="flex-1 rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className={`${primaryBtn} flex-1`}>
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
