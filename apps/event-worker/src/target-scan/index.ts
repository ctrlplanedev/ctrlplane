import type { InsertResource } from "@ctrlplane/db/schema";
import type { ResourceScanEvent } from "@ctrlplane/validators/events";
import type { Job } from "bullmq";
import { Queue, Worker } from "bullmq";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  resourceProvider,
  resourceProviderAws,
  resourceProviderGoogle,
  workspace,
} from "@ctrlplane/db/schema";
import { upsertResources } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { Channel } from "@ctrlplane/validators/events";

import { redis } from "../redis.js";
import { getEksResources } from "./eks.js";
import { getGkeResources } from "./gke.js";

const log = logger.child({ label: "resource-scan" });

const resourceScanQueue = new Queue(Channel.ResourceScan, {
  connection: redis,
});

const removeResourceJob = (job: Job) =>
  job.repeatJobKey != null
    ? resourceScanQueue.removeRepeatableByKey(job.repeatJobKey)
    : null;

const createResourceScanWorker = (
  scanResources: (rp: any) => Promise<InsertResource[]>,
) =>
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
        .leftJoin(
          resourceProviderAws,
          eq(resourceProvider.id, resourceProviderAws.resourceProviderId),
        )
        .then(takeFirstOrNull);

      if (rp == null) {
        log.error(`Resource provider with ID ${resourceProviderId} not found.`);
        await removeResourceJob(job);
        return;
      }

      log.info(
        `Received scanning request for "${rp.resource_provider.name}" (${resourceProviderId}).`,
      );

      try {
        const resources = await scanResources(rp);

        log.info(
          `Upserting ${resources.length} resources for provider ${rp.resource_provider.id}`,
        );

        if (resources.length > 0) {
          await upsertResources(db, resources);
        } else {
          log.info(
            `No resources found for provider ${rp.resource_provider.id}, skipping upsert.`,
          );
        }
      } catch (error: any) {
        log.error(
          `Error scanning/upserting resources for provider ${rp.resource_provider.id}: ${error.message}`,
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

export const createGoogleResourceScanWorker = () =>
  createResourceScanWorker(async (rp) => {
    if (rp.resource_provider_google == null) {
      log.info(
        `No Google provider found for resource provider ${rp.resource_provider.id}, skipping scan`,
      );
      return [];
    }

    const resources: InsertResource[] = [];
    log.info("Found Google config, scanning for GKE resources");

    const gkeResources = await getGkeResources(
      rp.workspace,
      rp.resource_provider_google,
    );
    resources.push(...gkeResources);

    return resources;
  });

export const createAwsResourceScanWorker = () =>
  createResourceScanWorker(async (rp) => {
    if (rp.resource_provider_aws == null) {
      log.info(
        `No AWS provider found for resource provider ${rp.resource_provider.id}, skipping scan`,
      );
      return [];
    }

    const resources: InsertResource[] = [];
    log.info("Found AWS config, scanning for EKS resources");

    const eksResources = await getEksResources(
      rp.workspace,
      rp.resource_provider_aws,
    );
    resources.push(...eksResources);

    return resources;
  });
