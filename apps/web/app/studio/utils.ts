import { MAX_SAMPLE_EVIDENCE_IMAGE_CHARS } from "@nimiqearn/shared/limits";

/**
 * Read an image File and return a compressed JPEG data URL that fits `maxChars`.
 *
 * Up to MAX_SAMPLE_EVIDENCE_UPLOADS sample images share one 1 MiB request body, so we shrink
 * the longest edge and drop JPEG quality until the image fits its share. Rejects non-images.
 */
export async function compressImage(
  file: File,
  maxChars: number = MAX_SAMPLE_EVIDENCE_IMAGE_CHARS,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    // Use the DOM element explicitly (avoid clashing with next/image if imported).
    const el = document.createElement("img");
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That doesn't look like an image."));
    el.src = dataUrl;
  });

  let longest = 1000;
  let quality = 0.7;
  let out = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    const scale = Math.min(1, longest / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process that image.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    out = canvas.toDataURL("image/jpeg", quality);
    if (out.length <= maxChars) return out;
    longest = Math.round(longest * 0.8);
    quality = Math.max(0.35, quality - 0.1);
  }
  return out;
}

export function isStudioPreview(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

export function formatNim(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

const LUNA_PER_NIM = 100_000;

/**
 * Display mirror of the API's tasker-fee split (`splitRewardLuna`): the fee is floored at
 * luna precision so the worker's share is the exact remainder. Display only — the API is
 * authoritative for what actually moves on-chain.
 */
export function splitRewardNim(
  rewardNim: number,
  taskerFeePercent: number,
): { workerNim: number; feeNim: number } {
  if (!Number.isFinite(rewardNim) || rewardNim <= 0) return { workerNim: 0, feeNim: 0 };
  const rewardLuna = Math.round(rewardNim * LUNA_PER_NIM);
  if (!(taskerFeePercent > 0)) return { workerNim: rewardLuna / LUNA_PER_NIM, feeNim: 0 };
  const basisPoints = Math.round(taskerFeePercent * 100); // 7.5% -> 750
  const feeLuna = Math.floor((rewardLuna * basisPoints) / 10_000);
  return { workerNim: (rewardLuna - feeLuna) / LUNA_PER_NIM, feeNim: feeLuna / LUNA_PER_NIM };
}

