import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";
import { HookAction } from "@ctrlplane/validators/events";

const softDeleteResource = async (tx: Tx, resource: SCHEMA.Resource) =>
  tx
    .update(SCHEMA.resource)
    .set({ deletedAt: new Date() })
    .where(eq(SCHEMA.resource.id, resource.id));

const deleteReleaseTargets = async (tx: Tx, resource: SCHEMA.Resource) =>
  tx
    .delete(SCHEMA.releaseTarget)
    .where(eq(SCHEMA.releaseTarget.resourceId, resource.id))
    .returning();

const deleteComputedResources = async (tx: Tx, resource: SCHEMA.Resource) =>
  Promise.all([
    tx
      .delete(SCHEMA.computedDeploymentResource)
      .where(eq(SCHEMA.computedDeploymentResource.resourceId, resource.id)),
    tx
      .delete(SCHEMA.computedEnvironmentResource)
      .where(eq(SCHEMA.computedEnvironmentResource.resourceId, resource.id)),
  ]);

const deleteComputedReleaseTargets = async (
  tx: Tx,
  releaseTargets: SCHEMA.ReleaseTarget[],
) =>
  tx.delete(SCHEMA.computedPolicyTargetReleaseTarget).where(
    inArray(
      SCHEMA.computedPolicyTargetReleaseTarget.releaseTargetId,
      releaseTargets.map((rt) => rt.id),
    ),
  );

const dispatchExitHooks = async (
  tx: Tx,
  resource: SCHEMA.Resource,
  deletedReleaseTargets: SCHEMA.ReleaseTarget[],
) => {
  const deploymentIds = _.uniq(
    deletedReleaseTargets.map((rt) => rt.deploymentId),
  );
  const deployments = await tx.query.deployment.findMany({
    where: inArray(SCHEMA.deployment.id, deploymentIds),
  });
  const events = deployments.map((deployment) => ({
    action: HookAction.DeploymentResourceRemoved,
    payload: { deployment, resource },
  }));
  const handleEventPromises = events.map(handleEvent);
  await Promise.allSettled(handleEventPromises);
};

export const deleteResourceWorker = createWorker(
  Channel.DeleteResource,
  async ({ data: resource }) => {
    await db.transaction(async (tx) => {
      await softDeleteResource(tx, resource);
      await deleteComputedResources(tx, resource);
      const rts = await deleteReleaseTargets(tx, resource);
      await deleteComputedReleaseTargets(tx, rts);
      await dispatchExitHooks(tx, resource, rts);
    });
  },
);
