import { eq } from "drizzle-orm";

import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";
import * as schema from "../schema/index.js";
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
  return enqueueManyDesiredRelease(
    db,
    releaseTargets.map((releaseTarget) => ({
      workspaceId,
      deploymentId: releaseTarget.deploymentId,
      environmentId: releaseTarget.environmentId,
      resourceId: releaseTarget.resourceId,
    })),
  );
};

export const enqueueReleaseTargetsForEnvironment = async (
  db: Tx,
  workspaceId: string,
  environmentId: string,
) => {
  const releaseTargets = await db
    .selectDistinctOn([schema.deployment.id, schema.resource.id], {
      deploymentId: schema.deployment.id,
      resourceId: schema.resource.id,
    })
    .from(schema.systemEnvironment)
    .innerJoin(
      schema.systemDeployment,
      eq(schema.systemEnvironment.systemId, schema.systemDeployment.systemId),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.systemDeployment.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.computedEnvironmentResource,
      eq(
        schema.systemEnvironment.environmentId,
        schema.computedEnvironmentResource.environmentId,
      ),
    )
    .innerJoin(
      schema.resource,
      eq(schema.computedEnvironmentResource.resourceId, schema.resource.id),
    )
    .where(eq(schema.systemEnvironment.environmentId, environmentId));

  return enqueueManyDesiredRelease(
    db,
    releaseTargets.map((rt) => ({
      workspaceId,
      deploymentId: rt.deploymentId,
      environmentId,
      resourceId: rt.resourceId,
    })),
  );
};

export const enqueueReleaseTargetsForDeployment = async (
  db: Tx,
  workspaceId: string,
  deploymentId: string,
) => {
  const releaseTargets = await db
    .selectDistinctOn([schema.resource.id, schema.environment.id], {
      resourceId: schema.resource.id,
      environmentId: schema.environment.id,
    })
    .from(schema.systemDeployment)
    .innerJoin(
      schema.systemEnvironment,
      eq(schema.systemDeployment.systemId, schema.systemEnvironment.systemId),
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
    .where(eq(schema.systemDeployment.deploymentId, deploymentId));

  return enqueueManyDesiredRelease(
    db,
    releaseTargets.map((rt) => ({
      workspaceId,
      deploymentId,
      environmentId: rt.environmentId,
      resourceId: rt.resourceId,
    })),
  );
};
