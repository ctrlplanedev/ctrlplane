import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq, selector, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";

import { upsertReleaseTargets } from "../utils/upsert-release-targets.js";

const log = logger.child({ module: "update-deployment" });

const dispatchExitHooks = async (
  db: Tx,
  deployment: schema.Deployment,
  exitedResources: schema.Resource[],
) => {
  const events = exitedResources.map((resource) => ({
    action: "deployment.resource.removed" as const,
    payload: { deployment, resource },
  }));

  const handleEventPromises = events.map(handleEvent);
  await Promise.allSettled(handleEventPromises);
};

const recomputeResourcesAndReturnDiff = async (
  db: Tx,
  deploymentId: string,
) => {
  const currentComputedResources = await db
    .select()
    .from(schema.computedDeploymentResource)
    .innerJoin(
      schema.resource,
      eq(schema.computedDeploymentResource.resourceId, schema.resource.id),
    )
    .where(eq(schema.computedDeploymentResource.deploymentId, deploymentId));
  const currentResources = currentComputedResources.map((r) => r.resource);

  await selector()
    .compute()
    .deployments([deploymentId])
    .resourceSelectors()
    .replace();

  const newComputedResources = await db
    .select()
    .from(schema.computedDeploymentResource)
    .innerJoin(
      schema.resource,
      eq(schema.computedDeploymentResource.resourceId, schema.resource.id),
    )
    .where(eq(schema.computedDeploymentResource.deploymentId, deploymentId));
  const newResources = newComputedResources.map((r) => r.resource);

  const exitedResources = currentResources.filter(
    (r) => !newResources.some((nr) => nr.id === r.id),
  );

  return { newResources, exitedResources };
};

export const updateDeploymentWorker = createWorker(
  Channel.UpdateDeployment,
  async ({ data }) => {
    try {
      const { oldSelector, resourceSelector } = data;
      if (_.isEqual(oldSelector, resourceSelector)) return;

      const { newResources, exitedResources } =
        await recomputeResourcesAndReturnDiff(db, data.id);

      const system = await db
        .select()
        .from(schema.system)
        .where(eq(schema.system.id, data.systemId))
        .then(takeFirst);
      const { workspaceId } = system;

      const releaseTargetPromises = newResources.map(async (r) =>
        upsertReleaseTargets(db, r),
      );
      const fulfilled = await Promise.all(releaseTargetPromises);
      const rts = fulfilled.flat();
      await selector()
        .compute()
        .allPolicies(workspaceId)
        .releaseTargetSelectors()
        .replace();

      const evaluateJobs = rts.map((rt) => ({ name: rt.id, data: rt }));
      await getQueue(Channel.EvaluateReleaseTarget).addBulk(evaluateJobs);

      await dispatchExitHooks(db, data, exitedResources);
    } catch (error) {
      log.error("Error updating deployment", { error });
      throw error;
    }
  },
);
