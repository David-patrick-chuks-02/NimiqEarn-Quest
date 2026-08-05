/**
 * Optional BullMQ payout queue. When PAYOUT_QUEUE_ENABLED=1 and REDIS_URL is set,
 * AUTO_APPROVE enqueues payouts instead of transferring inline.
 *
 * Run the worker: `pnpm --filter @nimiqearn/api payout-worker`
 */
import { Queue, Worker, type Job } from "bullmq";

export const PAYOUT_QUEUE_NAME = "nimiqearn-payouts";

export interface PayoutJobData {
  submissionId: string;
  questId: string;
  toAddress: string;
  valueLuna: string;
  fromKeyCiphertext: string;
}

function queueEnabled(): boolean {
  return process.env.PAYOUT_QUEUE_ENABLED === "1" && Boolean(process.env.REDIS_URL);
}

function redisConnection() {
  return { url: process.env.REDIS_URL! };
}

let queueSingleton: Queue<PayoutJobData> | null = null;

export function isPayoutQueueEnabled(): boolean {
  return queueEnabled();
}

export function getPayoutQueue(): Queue<PayoutJobData> | null {
  if (!queueEnabled()) return null;
  if (!queueSingleton) {
    queueSingleton = new Queue<PayoutJobData>(PAYOUT_QUEUE_NAME, {
      connection: redisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 3_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return queueSingleton;
}

export async function enqueuePayout(data: PayoutJobData): Promise<boolean> {
  const q = getPayoutQueue();
  if (!q) return false;
  await q.add("payout", data, { jobId: `payout-${data.submissionId}` });
  return true;
}

export type PayoutTransferFn = (job: PayoutJobData) => Promise<{ hash: string | null; error?: string }>;

/**
 * Start a BullMQ worker that calls `transfer` for each payout job.
 * Returns null when the queue is disabled.
 */
export function startPayoutWorker(transfer: PayoutTransferFn): Worker<PayoutJobData> | null {
  if (!queueEnabled()) return null;

  return new Worker<PayoutJobData>(
    PAYOUT_QUEUE_NAME,
    async (job: Job<PayoutJobData>) => {
      const result = await transfer(job.data);
      if (!result.hash) {
        throw new Error(result.error ?? "Payout transfer failed");
      }
      return { hash: result.hash };
    },
    { connection: redisConnection(), concurrency: 2 },
  );
}
