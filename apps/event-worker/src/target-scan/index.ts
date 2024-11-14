import type { InsertResource } from "@ctrlplane/db/schema";
import type { TargetScanEvent } from "@ctrlplane/validators/events";
import type { Job } from "bullmq";
import { Queue, Worker } from "bullmq";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  resourceProvider,
  resourceProviderGoogle,
  workspace,
} from "@ctrlplane/db/schema";
import { upsertResources } from "@ctrlplane/job-dispatch";
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
        .from(resourceProvider)
        .where(eq(resourceProvider.id, targetProviderId))
        .innerJoin(workspace, eq(resourceProvider.workspaceId, workspace.id))
        .leftJoin(
          resourceProviderGoogle,
          eq(resourceProvider.id, resourceProviderGoogle.resourceProviderId),
        )
        .then(takeFirstOrNull);

      if (tp == null) {
        logger.error(`Target provider with ID ${targetProviderId} not found.`);
        await removeTargetJob(job);
        return;
      }

      logger.info(
        `Received scanning request for "${tp.resource_provider.name}" (${targetProviderId}).`,
      );

      const targets: InsertResource[] = [];

      if (tp.resource_provider_google != null) {
        logger.info("Found Google config, scanning for GKE targets");
        try {
          const gkeTargets = await getGkeTargets(
            tp.workspace,
            tp.resource_provider_google,
          );
          targets.push(...gkeTargets);
        } catch (error: any) {
          logger.error(`Error scanning GKE targets: ${error.message}`, {
            error,
          });
        }
      }

      try {
        logger.info(
          `Upserting ${targets.length} targets for provider ${tp.resource_provider.id}`,
        );
        if (targets.length > 0) {
          await upsertResources(db, targets);
        } else {
          logger.info(
            `No targets found for provider ${tp.resource_provider.id}, skipping upsert.`,
          );
        }
      } catch (error: any) {
        logger.error(
          `Error upserting targets for provider ${tp.resource_provider.id}: ${error.message}`,
          { error },
        );
      }
    },
    {
      connection: redis,
      removeOnComplete: { age: 1 * 60 * 60, count: 5000 },
      removeOnFail: { age: 12 * 60 * 60, count: 5000 },
      concurrency: 10,
    },
  );
