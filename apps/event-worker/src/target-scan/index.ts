import type { TargetScanEvent } from "@ctrlplane/validators/events";
import { Queue, Worker } from "bullmq";
import ms from "ms";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  targetProvider,
  targetProviderGoogle,
  workspace,
} from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Channel } from "@ctrlplane/validators/events";

import { redis } from "../redis.js";
import { getGkeTargets } from "./gke.js";
import { upsertTargets } from "./upsert.js";

const targetScanQueue = new Queue(Channel.TargetScan, { connection: redis });
const requeue = (data: any, delay: number) =>
  targetScanQueue.add(Channel.TargetScan, data, { delay });

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
      if (tp == null) return;

      logger.info(
        `Received scanning request for "${tp.target_provider.name}" (${targetProviderId}).`,
      );

      if (tp.target_provider_google != null) {
        logger.info("Found Google config, scanning for GKE targets");
        const gkeTargets = await getGkeTargets(
          tp.workspace,
          tp.target_provider_google,
        );

        await upsertTargets(db, tp.workspace.id, gkeTargets);
      }

      await requeue(job.data, ms("5m"));
      //
    },
    { connection: redis, concurrency: 10 },
  );
