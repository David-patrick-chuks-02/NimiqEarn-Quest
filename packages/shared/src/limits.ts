/**
 * Upload limits for inline image media.
 *
 * Deliberately a standalone module with no imports: the barrel (`index.ts`) re-exports
 * `load-env`, which pulls in `node:url`, so client components must import this path instead
 * (`@nimiqearn/shared/limits`) to stay bundleable in the browser.
 *
 * The API runs Fastify with its default 1 MiB `bodyLimit`, so a submission's whole JSON body
 * (every data URL plus envelope) must stay comfortably under 1,048,576 bytes. These caps keep
 * MAX_UPLOAD_FILES images inside that budget — 3 x 330,000 = 990,000 chars, leaving headroom.
 */

/** Max inline image uploads accepted in one request (worker proof, or creator sample evidence). */
const UPLOAD_FILES = 3;

/** Per-image data-URL cap (chars) so `UPLOAD_FILES` images fit in one request. */
const UPLOAD_IMAGE_CHARS = 330_000;

/** Hard cap on the summed data-URL length across all image uploads in one request. */
const UPLOAD_TOTAL_CHARS = 1_000_000;

// ── Worker proof uploads ──────────────────────────────────────────────────────

/** Max proof files a worker can attach to one submission. */
export const MAX_PROOF_UPLOADS = UPLOAD_FILES;

/** Per-image data-URL cap (chars) for a proof upload. */
export const MAX_PROOF_IMAGE_CHARS = UPLOAD_IMAGE_CHARS;

/** A video can't be compressed client-side, so it must ride alone and can use the full budget. */
export const MAX_PROOF_VIDEO_CHARS = 1_000_000;

/** Hard cap on the summed data-URL length across all proof items in one submission. */
export const MAX_PROOF_TOTAL_CHARS = UPLOAD_TOTAL_CHARS;

// ── Creator sample evidence ───────────────────────────────────────────────────

/** Max sample-evidence images a creator can attach to one quest. */
export const MAX_SAMPLE_EVIDENCE_UPLOADS = UPLOAD_FILES;

/** Per-image data-URL cap (chars) for a sample-evidence upload. */
export const MAX_SAMPLE_EVIDENCE_IMAGE_CHARS = UPLOAD_IMAGE_CHARS;
