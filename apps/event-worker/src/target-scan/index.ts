import type { TargetScanEvent } from "@ctrlplane/validators/events";
import type { Job } from "bullmq";
import { Queue, Worker } from "bullmq";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  targetProvider,
  targetProviderGoogle,
  workspace,
} from "@ctrlplane/db/schema";
import { upsertTargets } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { Channel } from "@ctrlplane/validators/events";

import { redis } from "../redis.js";
import { getGkeTargets } from "./gke.js";

const targetScanQueue = new Queue(Channel.TargetScan, { connection: redis });
const removeTargetJob = (job: Job) =>
  job.repeatJobKey != null
    ? targetScanQueue.removeRepeatableByKey(job.repeatJobKey)
    : null;

export const createTargetScanWorker = () =>
  new Worker<TargetScanEvent>(
    Channel.TargetScan,
    async (job) => {
      const { targetProviderId } = job.data;

      const tp = await db
        .select()
        .from(targetProvider)
        .where(eq(targetProvider.id, targetProviderId))
        .innerJoin(workspace, eq(targetProvider.workspaceId, workspace.id))
        .leftJoin(
          targetProviderGoogle,
          eq(targetProvider.id, targetProviderGoogle.targetProviderId),
        )
        .then(takeFirstOrNull);

      if (tp == null) {
        await removeTargetJob(job);
        return;
      }

      logger.info(
        `Received scanning request for "${tp.target_provider.name}" (${targetProviderId}).`,
      );

      if (tp.target_provider_google != null) {
        logger.info("Found Google config, scanning for GKE targets");
        const gkeTargets = await getGkeTargets(
          tp.workspace,
          tp.target_provider_google,
        );

        await upsertTargets(db, gkeTargets);
      }
    },
    {
      connection: redis,
      removeOnComplete: { age: 0, count: 0 },
      concurrency: 10,
    },
  );
