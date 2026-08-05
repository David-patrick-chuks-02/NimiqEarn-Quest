/**
 * BullMQ payout worker entrypoint.
 * Usage: PAYOUT_QUEUE_ENABLED=1 REDIS_URL=… node apps/api/dist/workers/payout-worker.js
 */
import { loadRootEnv } from "@nimiqearn/shared";
loadRootEnv();

import { createEscrowService } from "../services/escrow.service.js";
import { startPayoutWorker } from "../services/payout-queue.js";
import { PrismaClient } from "@nimiqearn/database";

async function main() {
  if (process.env.PAYOUT_QUEUE_ENABLED !== "1" || !process.env.REDIS_URL) {
    console.error("Set PAYOUT_QUEUE_ENABLED=1 and REDIS_URL to run the payout worker.");
    process.exit(1);
  }

  const db = new PrismaClient();
  const escrow = createEscrowService({
    encryptionKey: process.env.ESCROW_ENCRYPTION_KEY,
    rpcUrl: process.env.NIMIQ_RPC_URL,
    network: (process.env.NIMIQ_NETWORK as "testnet" | "mainnet") ?? "testnet",
  });

  const worker = startPayoutWorker(async (job) => {
    const result = await escrow.transfer({
      fromKeyCiphertext: job.fromKeyCiphertext,
      toAddress: job.toAddress,
      valueLuna: BigInt(job.valueLuna),
    });
    if (result.hash) {
      await db.questSubmission.update({
        where: { id: job.submissionId },
        data: { payoutTxHash: result.hash, paidAt: new Date() },
      });
    }
    return { hash: result.hash ?? null, error: result.error };
  });

  if (!worker) {
    console.error("Payout worker failed to start.");
    process.exit(1);
  }

  console.log("Payout worker listening on queue nimiqearn-payouts");
  worker.on("failed", (job, err) => {
    console.error("Payout job failed", job?.id, err.message);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
