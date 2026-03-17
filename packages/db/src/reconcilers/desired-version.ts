import { and, eq } from "drizzle-orm";

import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";
import * as schema from "../schema/index.js";
import { enqueue, enqueueMany } from "./enqueue.js";

const getAllReleaseTargets = async (db: Tx, workspaceId: string) => {
  const releaseTargets = await db
    .selectDistinct({
      deploymentId: schema.computedDeploymentResource.deploymentId,
      environmentId: schema.computedEnvironmentResource.environmentId,
      resourceId: schema.computedDeploymentResource.resourceId,
    })
    .from(schema.computedDeploymentResource)
    .innerJoin(
      schema.computedEnvironmentResource,
      eq(
        schema.computedDeploymentResource.resourceId,
        schema.computedEnvironmentResource.resourceId,
      ),
    )
    .innerJoin(
      schema.systemDeployment,
      eq(
        schema.computedDeploymentResource.deploymentId,
        schema.systemDeployment.deploymentId,
      ),
    )
    .innerJoin(
      schema.systemEnvironment,
      and(
        eq(
          schema.computedEnvironmentResource.environmentId,
          schema.systemEnvironment.environmentId,
        ),
        eq(schema.systemDeployment.systemId, schema.systemEnvironment.systemId),
      ),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.computedDeploymentResource.deploymentId, schema.deployment.id),
    )
    .where(eq(schema.deployment.workspaceId, workspaceId));

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
    .selectDistinct({
      deploymentId: schema.computedDeploymentResource.deploymentId,
      resourceId: schema.computedDeploymentResource.resourceId,
    })
    .from(schema.computedDeploymentResource)
    .innerJoin(
      schema.computedEnvironmentResource,
      eq(
        schema.computedDeploymentResource.resourceId,
        schema.computedEnvironmentResource.resourceId,
      ),
    )
    .innerJoin(
      schema.systemDeployment,
      eq(
        schema.computedDeploymentResource.deploymentId,
        schema.systemDeployment.deploymentId,
      ),
    )
    .innerJoin(
      schema.systemEnvironment,
      and(
        eq(
          schema.computedEnvironmentResource.environmentId,
          schema.systemEnvironment.environmentId,
        ),
        eq(schema.systemDeployment.systemId, schema.systemEnvironment.systemId),
      ),
    )
    .where(
      eq(schema.computedEnvironmentResource.environmentId, environmentId),
    );

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
    .selectDistinct({
      resourceId: schema.computedDeploymentResource.resourceId,
      environmentId: schema.computedEnvironmentResource.environmentId,
    })
    .from(schema.computedDeploymentResource)
    .innerJoin(
      schema.computedEnvironmentResource,
      eq(
        schema.computedDeploymentResource.resourceId,
        schema.computedEnvironmentResource.resourceId,
      ),
    )
    .innerJoin(
      schema.systemDeployment,
      eq(
        schema.computedDeploymentResource.deploymentId,
        schema.systemDeployment.deploymentId,
      ),
    )
    .innerJoin(
      schema.systemEnvironment,
      and(
        eq(
          schema.computedEnvironmentResource.environmentId,
          schema.systemEnvironment.environmentId,
        ),
        eq(schema.systemDeployment.systemId, schema.systemEnvironment.systemId),
      ),
    )
    .where(eq(schema.computedDeploymentResource.deploymentId, deploymentId));

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

export const enqueueReleaseTargetsForResource = async (
  db: Tx,
  workspaceId: string,
  resourceId: string,
) => {
  const releaseTargets = await db
    .selectDistinct({
      deploymentId: schema.computedDeploymentResource.deploymentId,
      environmentId: schema.computedEnvironmentResource.environmentId,
    })
    .from(schema.computedDeploymentResource)
    .innerJoin(
      schema.computedEnvironmentResource,
      eq(
        schema.computedDeploymentResource.resourceId,
        schema.computedEnvironmentResource.resourceId,
      ),
    )
    .innerJoin(
      schema.systemDeployment,
      eq(
        schema.computedDeploymentResource.deploymentId,
        schema.systemDeployment.deploymentId,
      ),
    )
    .innerJoin(
      schema.systemEnvironment,
      and(
        eq(
          schema.computedEnvironmentResource.environmentId,
          schema.systemEnvironment.environmentId,
        ),
        eq(schema.systemDeployment.systemId, schema.systemEnvironment.systemId),
      ),
    )
    .where(eq(schema.computedDeploymentResource.resourceId, resourceId));

  return enqueueManyDesiredRelease(
    db,
    releaseTargets.map((rt) => ({
      workspaceId,
      deploymentId: rt.deploymentId,
      environmentId: rt.environmentId,
      resourceId,
    })),
  );
};
