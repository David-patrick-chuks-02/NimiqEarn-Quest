/**
 * Read an image File and return a compressed JPEG data URL (max ~1000px, quality 0.7),
 * so sample-evidence uploads stay small enough to store inline. Rejects non-images.
 */
export async function compressImage(file: File): Promise<string> {
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
  const max = 1000;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7  );
}

export function isStudioPreview(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

export function formatNim(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

