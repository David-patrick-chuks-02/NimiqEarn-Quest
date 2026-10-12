/**
 * Worker proof-upload limits.
 *
 * Deliberately a standalone module with no imports: the barrel (`index.ts`) re-exports
 * `load-env`, which pulls in `node:url`, so client components must import this path instead
 * (`@nimiqearn/shared/limits`) to stay bundleable in the browser.
 *
 * The API runs Fastify with its default 1 MiB `bodyLimit`, so a submission's whole JSON body
 * (every data URL plus envelope) must stay comfortably under 1,048,576 bytes. These caps keep
 * MAX_PROOF_UPLOADS images inside that budget — 3 x 330,000 = 990,000 chars, leaving headroom.
 */
export const MAX_PROOF_UPLOADS = 3;

/** Per-image data-URL cap (chars) so `MAX_PROOF_UPLOADS` images fit in one request. */
export const MAX_PROOF_IMAGE_CHARS = 330_000;

/** A video can't be compressed client-side, so it must ride alone and can use the full budget. */
export const MAX_PROOF_VIDEO_CHARS = 1_000_000;

/** Hard cap on the summed data-URL length across all proof items in one submission. */
export const MAX_PROOF_TOTAL_CHARS = 1_000_000;
