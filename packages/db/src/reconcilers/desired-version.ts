import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";
import * as schema from "../schema/index.js";
import { eq } from "drizzle-orm";

import { enqueue, enqueueMany } from "./enqueue.js";

const getAllReleaseTargets = async (db: Tx, workspaceId: string) => {
  const releaseTargets = await db
    .selectDistinctOn(
      [schema.deployment.id, schema.resource.id, schema.environment.id],
      {
        deploymentId: schema.deployment.id,
        resourceId: schema.resource.id,
        environmentId: schema.environment.id,
      },
    )
    .from(schema.system)
    .innerJoin(
      schema.systemDeployment,
      eq(schema.system.id, schema.systemDeployment.systemId),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.systemDeployment.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.systemEnvironment,
      eq(schema.system.id, schema.systemEnvironment.systemId),
    )
    .innerJoin(
      schema.environment,
      eq(schema.systemEnvironment.environmentId, schema.environment.id),
    )
    .innerJoin(
      schema.computedEnvironmentResource,
      eq(
        schema.environment.id,
        schema.computedEnvironmentResource.environmentId,
      ),
    )
    .innerJoin(
      schema.resource,
      eq(schema.computedEnvironmentResource.resourceId, schema.resource.id),
    )
    .where(eq(schema.system.workspaceId, workspaceId));

  return releaseTargets;
};

const DESIRED_RELEASE_KIND = "desired-release";

export async function enqueueDesiredRelease(
  db: Tx,
  params: {
    workspaceId: string;
    deploymentId: string;
    environmentId: string;
    resourceId: string;
  },
): Promise<ReconcileWorkScope> {
  return enqueue(db, {
    workspaceId: params.workspaceId,
    kind: DESIRED_RELEASE_KIND,
    scopeType: "release-target",
    scopeId: `${params.deploymentId}:${params.environmentId}:${params.resourceId}`,
  });
}

export async function enqueueManyDesiredRelease(
  db: Tx,
  items: Array<{
    workspaceId: string;
    deploymentId: string;
    environmentId: string;
    resourceId: string;
  }>,
): Promise<void> {
  return enqueueMany(
    db,
    items.map((item) => ({
      workspaceId: item.workspaceId,
      kind: DESIRED_RELEASE_KIND,
      scopeType: "release-target",
      scopeId: `${item.deploymentId}:${item.environmentId}:${item.resourceId}`,
    })),
  );
}

export const enqueueAllReleaseTargetsDesiredVersion = async (
  db: Tx,
  workspaceId: string,
) => {
  const releaseTargets = await getAllReleaseTargets(db, workspaceId);
  return enqueueManyDesiredRelease(db, releaseTargets.map((releaseTarget) => ({
    workspaceId: workspaceId,
    deploymentId: releaseTarget.deploymentId,
    environmentId: releaseTarget.environmentId,
    resourceId: releaseTarget.resourceId,
  })));
};