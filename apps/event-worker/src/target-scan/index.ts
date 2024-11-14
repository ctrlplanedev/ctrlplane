import type { InsertResource } from "@ctrlplane/db/schema";
import type { ResourceScanEvent } from "@ctrlplane/validators/events";
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
import { getGkeResources } from "./gke.js";

const resourceScanQueue = new Queue(Channel.ResourceScan, {
  connection: redis,
});
const removeResourceJob = (job: Job) =>
  job.repeatJobKey != null
    ? resourceScanQueue.removeRepeatableByKey(job.repeatJobKey)
    : null;

export const createResourceScanWorker = () =>
  new Worker<ResourceScanEvent>(
    Channel.ResourceScan,
    async (job) => {
      const { resourceProviderId } = job.data;

      const rp = await db
        .select()
        .from(resourceProvider)
        .where(eq(resourceProvider.id, resourceProviderId))
        .innerJoin(workspace, eq(resourceProvider.workspaceId, workspace.id))
        .leftJoin(
          resourceProviderGoogle,
          eq(resourceProvider.id, resourceProviderGoogle.resourceProviderId),
        )
        .then(takeFirstOrNull);

      if (rp == null) {
        logger.error(
          `Resource provider with ID ${resourceProviderId} not found.`,
        );
        await removeResourceJob(job);
        return;
      }

      logger.info(
        `Received scanning request for "${rp.resource_provider.name}" (${resourceProviderId}).`,
      );

      const resources: InsertResource[] = [];

      if (rp.resource_provider_google != null) {
        logger.info("Found Google config, scanning for GKE resources");
        try {
          const gkeResources = await getGkeResources(
            rp.workspace,
            rp.resource_provider_google,
          );
          resources.push(...gkeResources);
        } catch (error: any) {
          logger.error(`Error scanning GKE resources: ${error.message}`, {
            error,
          });
        }
      }

      try {
        logger.info(
          `Upserting ${resources.length} resources for provider ${rp.resource_provider.id}`,
        );
        if (resources.length > 0) {
          await upsertResources(db, resources);
        } else {
          logger.info(
            `No resources found for provider ${rp.resource_provider.id}, skipping upsert.`,
          );
        }
      } catch (error: any) {
        logger.error(
          `Error upserting resources for provider ${rp.resource_provider.id}: ${error.message}`,
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
