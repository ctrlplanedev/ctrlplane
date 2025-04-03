import type { Job } from "bullmq";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  resourceProvider,
  resourceProviderAws,
  resourceProviderAzure,
  resourceProviderGoogle,
  workspace,
} from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { upsertResources } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";

import { redis } from "../../redis.js";
import { getEksResources } from "./aws/eks.js";
import { getVpcResources as getAwsVpcResources } from "./aws/vpc.js";
import { getAksResources } from "./azure/aks.js";
import { getGkeResources } from "./google/gke.js";
import { getGoogleVMResources } from "./google/vm.js";
import { getVpcResources as getGoogleVpcResources } from "./google/vpc.js";

const log = logger.child({ label: "resource-scan" });

const resourceScanQueue = getQueue(Channel.ResourceScan);

const removeResourceJob = (job: Job) =>
  job.repeatJobKey != null
    ? resourceScanQueue.removeRepeatableByKey(job.repeatJobKey)
    : null;

const getResources = async (rp: any) => {
  if (rp.resource_provider_google != null) {
    const [gkeResources, vpcResources, vmResources] = await Promise.all([
      getGkeResources(rp.workspace, rp.resource_provider_google),
      getGoogleVpcResources(rp.workspace, rp.resource_provider_google),
      getGoogleVMResources(rp.workspace, rp.resource_provider_google),
    ]);
    return [...gkeResources, ...vpcResources, ...vmResources];
  }

  if (rp.resource_provider_aws != null) {
    const [eksResources, vpcResources] = await Promise.all([
      getEksResources(rp.workspace, rp.resource_provider_aws),
      getAwsVpcResources(rp.workspace, rp.resource_provider_aws),
    ]);
    return [...eksResources, ...vpcResources];
  }

  if (rp.resource_provider_azure != null)
    return getAksResources(rp.workspace, rp.resource_provider_azure);
  throw new Error("Invalid resource provider");
};

export const resourceScanWorker = createWorker(
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
      .leftJoin(
        resourceProviderAzure,
        eq(resourceProvider.id, resourceProviderAzure.resourceProviderId),
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
      const resources = await getResources(rp);
      if (resources.length === 0) {
        log.info(
          `No resources found for provider ${rp.resource_provider.id}, skipping upsert.`,
        );
        return;
      }

      log.info(
        `Upserting ${resources.length} resources for provider ${rp.resource_provider.id}`,
      );
      await upsertResources(db, resources);
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
