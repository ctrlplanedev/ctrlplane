import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq, inArray, selector, takeFirst } from "@ctrlplane/db";
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

/**
 * Extracted into its own function to solve for the following edge case -
 *   if are are setting a resource selector on a deployment to null
 *   then beacuse we do not store computed resources for deployments with no
 *   resource selector, we need to compute the resources based on the environments
 *   in the system that the deployment is in.
 *
 *  Otherwise, just use the computed resources for the deployment if it is
 *   not null.
 *
 * @param db
 * @param deployment
 * @returns
 */
const getNewDeploymentComputedResources = async (
  db: Tx,
  deployment: schema.Deployment,
) => {
  if (deployment.resourceSelector != null)
    return db
      .select()
      .from(schema.computedDeploymentResource)
      .innerJoin(
        schema.resource,
        eq(schema.computedDeploymentResource.resourceId, schema.resource.id),
      )
      .where(eq(schema.computedDeploymentResource.deploymentId, deployment.id))
      .then((rows) => rows.map((r) => r.resource));

  const system = await db.query.system.findFirst({
    where: eq(schema.system.id, deployment.systemId),
    with: { environments: true },
  });
  if (system == null) throw new Error("System not found");

  const releaseTargets = await db.query.releaseTarget.findMany({
    where: inArray(
      schema.releaseTarget.environmentId,
      system.environments.map((e) => e.id),
    ),
    with: { resource: true },
  });

  return releaseTargets.map((rt) => rt.resource);
};

const recomputeResourcesAndReturnDiff = async (
  db: Tx,
  deployment: schema.Deployment,
) => {
  /*
   we use the release targest instead of the computed resources 
   because a deployment with no resource selector technically matches all 
   deployments but won't have any computed entries. Hence if you add a
   resource selector after the fact, if you used the previous computed resources
   to calculate the diff it would not be picked up
  */
  const currentComputedResources = await db
    .selectDistinctOn([schema.releaseTarget.resourceId])
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .where(eq(schema.releaseTarget.deploymentId, deployment.id));
  const currentResources = currentComputedResources.map((r) => r.resource);

  await selector()
    .compute()
    .deployments([deployment.id])
    .resourceSelectors()
    .replace();

  const newResources = await getNewDeploymentComputedResources(db, deployment);

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
        await recomputeResourcesAndReturnDiff(db, data);

      const system = await db
        .select()
        .from(schema.system)
        .where(eq(schema.system.id, data.systemId))
        .then(takeFirst);
      const { workspaceId } = system;
      const allResources = [...newResources, ...exitedResources];
      const releaseTargetPromises = allResources.map(async (r) =>
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
