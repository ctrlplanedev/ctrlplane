import type { Tx } from "@ctrlplane/db";

import { and, eq, inArray } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { HookAction } from "@ctrlplane/validators/events";

import { handleEvent } from "../events/index.js";

export const replaceReleaseTargetsAndDispatchExitHooks = async (
  db: Tx,
  resource: SCHEMA.Resource,
) => {
  const currReleaseTargets = await db.query.releaseTarget.findMany({
    where: eq(SCHEMA.releaseTarget.resourceId, resource.id),
  });

  const rows = await db
    .select()
    .from(SCHEMA.computedEnvironmentResource)
    .innerJoin(
      SCHEMA.environment,
      eq(
        SCHEMA.computedEnvironmentResource.environmentId,
        SCHEMA.environment.id,
      ),
    )
    .innerJoin(
      SCHEMA.deployment,
      eq(SCHEMA.deployment.systemId, SCHEMA.environment.systemId),
    )
    .leftJoin(
      SCHEMA.computedDeploymentResource,
      and(
        eq(
          SCHEMA.computedDeploymentResource.deploymentId,
          SCHEMA.deployment.id,
        ),
        eq(SCHEMA.computedDeploymentResource.resourceId, resource.id),
      ),
    )
    .where(eq(SCHEMA.computedEnvironmentResource.resourceId, resource.id));

  const targets = rows
    .filter(
      (r) =>
        r.deployment.resourceSelector == null ||
        r.computed_deployment_resource != null,
    )
    .map((r) => ({
      environmentId: r.environment.id,
      deploymentId: r.deployment.id,
      resourceId: resource.id,
    }));

  if (targets.length === 0) return [];
  const newReleaseTargets = await db
    .insert(SCHEMA.releaseTarget)
    .values(targets)
    .onConflictDoNothing()
    .returning();

  const previousDeploymentIds = currReleaseTargets.map((rt) => rt.deploymentId);
  const newDeploymentIds = newReleaseTargets.map((t) => t.deploymentId);
  const exitedDeploymentIds = previousDeploymentIds.filter(
    (id) => !newDeploymentIds.includes(id),
  );
  const exitedDeployments = await db.query.deployment.findMany({
    where: inArray(SCHEMA.deployment.id, exitedDeploymentIds),
  });

  const events = exitedDeployments.map((deployment) => ({
    action: HookAction.DeploymentResourceRemoved,
    payload: { deployment, resource },
  }));

  const handleEventPromises = events.map(handleEvent);
  await Promise.allSettled(handleEventPromises);

  return newReleaseTargets;
};
