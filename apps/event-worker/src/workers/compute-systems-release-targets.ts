import type { Tx } from "@ctrlplane/db";

import { and, eq, inArray, isNull, or, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

const findMatchingEnvironmentDeploymentPairs = (
  tx: Tx,
  system: { id: string; workspaceId: string },
) => {
  const { id: systemId, workspaceId } = system;

  const isResourceMatchingEnvironment = eq(
    schema.computedEnvironmentResource.resourceId,
    schema.resource.id,
  );
  const isResourceMatchingDeployment = or(
    isNull(schema.deployment.resourceSelector),
    eq(schema.computedDeploymentResource.resourceId, schema.resource.id),
  );

  return tx
    .select({
      environmentId: schema.environment.id,
      deploymentId: schema.deployment.id,
      resourceId: schema.resource.id,
    })
    .from(schema.resource)
    .innerJoin(
      schema.computedEnvironmentResource,
      eq(schema.computedEnvironmentResource.resourceId, schema.resource.id),
    )
    .innerJoin(
      schema.environment,
      eq(
        schema.computedEnvironmentResource.environmentId,
        schema.environment.id,
      ),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.deployment.systemId, schema.environment.systemId),
    )
    .leftJoin(
      schema.computedDeploymentResource,
      eq(schema.computedDeploymentResource.deploymentId, schema.deployment.id),
    )
    .where(
      and(
        isResourceMatchingEnvironment,
        isResourceMatchingDeployment,
        eq(schema.environment.systemId, systemId),
        eq(schema.deployment.systemId, systemId),
        eq(schema.resource.workspaceId, workspaceId),
        isNull(schema.resource.deletedAt),
      ),
    );
};

export const computeSystemsReleaseTargetsWorker = createWorker(
  Channel.ComputeSystemsReleaseTargets,
  async (job) => {
    const { id: systemId } = job.data;

    const system = await db.query.system.findFirst({
      where: eq(schema.system.id, systemId),
      with: { deployments: true, environments: true },
    });

    if (system == null) throw new Error("System not found");

    const { deployments, environments } = system;
    const deploymentIds = deployments.map((d) => d.id);
    const environmentIds = environments.map((e) => e.id);
    const { workspaceId } = system;

    try {
      const createdReleaseTargets = await db.transaction(async (tx) => {
        await tx.execute(
          sql`
            SELECT * FROM ${schema.system}
            INNER JOIN ${schema.environment} ON ${eq(schema.environment.systemId, schema.system.id)}
            INNER JOIN ${schema.deployment} ON ${eq(schema.deployment.systemId, schema.system.id)}
            INNER JOIN ${schema.releaseTarget} ON ${eq(schema.releaseTarget.environmentId, schema.environment.id)}
            WHERE ${eq(schema.system.id, systemId)}
            FOR UPDATE NOWAIT
          `,
        );

        const previousReleaseTargets = await tx
          .delete(schema.releaseTarget)
          .where(
            or(
              inArray(schema.releaseTarget.deploymentId, deploymentIds),
              inArray(schema.releaseTarget.environmentId, environmentIds),
            ),
          )
          .returning();

        const releaseTargets = await findMatchingEnvironmentDeploymentPairs(
          tx,
          system,
        );

        if (releaseTargets.length > 0)
          await tx
            .insert(schema.releaseTarget)
            .values(releaseTargets)
            .onConflictDoNothing();

        const created = releaseTargets.filter(
          (rt) =>
            !previousReleaseTargets.some(
              (prevRt) =>
                prevRt.deploymentId === rt.deploymentId &&
                prevRt.resourceId === rt.resourceId,
            ),
        );

        return created;
      });

      if (createdReleaseTargets.length === 0) return;

      const policyTargets = await db
        .select()
        .from(schema.policyTarget)
        .innerJoin(
          schema.policy,
          eq(schema.policyTarget.policyId, schema.policy.id),
        )
        .where(eq(schema.policy.workspaceId, workspaceId));

      for (const { policy_target: policyTarget } of policyTargets) {
        getQueue(Channel.ComputePolicyTargetReleaseTargetSelector).add(
          policyTarget.id,
          policyTarget,
          { deduplication: { id: policyTarget.id, ttl: 500 } },
        );
      }
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      if (isRowLocked) {
        await getQueue(Channel.ComputeSystemsReleaseTargets).add(
          job.name,
          job.data,
          { deduplication: { id: job.data.id, ttl: 500 } },
        );
        return;
      }

      throw e;
    }
  },
);
