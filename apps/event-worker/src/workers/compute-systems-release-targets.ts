import type { Tx } from "@ctrlplane/db";

import { and, eq, inArray, isNull, or, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

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

    if (deploymentIds.length === 0 || environmentIds.length === 0) return;

    try {
      const releaseTargets = await db.transaction(async (tx) => {
        await tx.execute(
          sql`
            SELECT ${schema.releaseTarget.id} FROM ${schema.releaseTarget}
            WHERE ${or(
              inArray(schema.releaseTarget.deploymentId, deploymentIds),
              inArray(schema.releaseTarget.environmentId, environmentIds),
            )}
            FOR UPDATE NOWAIT
          `,
        );

        await tx.execute(
          sql`
            SELECT * FROM ${schema.computedEnvironmentResource}
            WHERE ${inArray(schema.computedEnvironmentResource.environmentId, environmentIds)}
            FOR UPDATE NOWAIT
          `,
        );

        await tx.execute(
          sql`
            SELECT * FROM ${schema.computedDeploymentResource}
            WHERE ${inArray(schema.computedDeploymentResource.deploymentId, deploymentIds)}
            FOR UPDATE NOWAIT
          `,
        );

        const previousReleaseTargets = await tx.query.releaseTarget.findMany({
          where: or(
            inArray(schema.releaseTarget.deploymentId, deploymentIds),
            inArray(schema.releaseTarget.environmentId, environmentIds),
          ),
        });

        const releaseTargets = await findMatchingEnvironmentDeploymentPairs(
          tx,
          system,
        );

        const created = releaseTargets.filter(
          (rt) =>
            !previousReleaseTargets.some(
              (prevRt) =>
                prevRt.deploymentId === rt.deploymentId &&
                prevRt.resourceId === rt.resourceId &&
                prevRt.environmentId === rt.environmentId,
            ),
        );

        if (created.length > 0)
          await tx
            .insert(schema.releaseTarget)
            .values(created)
            .onConflictDoNothing();

        return tx.query.releaseTarget.findMany({
          where: or(
            inArray(schema.releaseTarget.deploymentId, deploymentIds),
            inArray(schema.releaseTarget.environmentId, environmentIds),
          ),
        });
      });

      if (releaseTargets.length === 0) return;

      const policyTargets = await db
        .select()
        .from(schema.policyTarget)
        .innerJoin(
          schema.policy,
          eq(schema.policyTarget.policyId, schema.policy.id),
        )
        .where(eq(schema.policy.workspaceId, workspaceId));

      if (policyTargets.length > 0) {
        for (const { policy_target: policyTarget } of policyTargets) {
          getQueue(Channel.ComputePolicyTargetReleaseTargetSelector).add(
            policyTarget.id,
            policyTarget,
          );
        }
        return;
      }

      await dispatchEvaluateJobs(releaseTargets);
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      if (isRowLocked) {
        await getQueue(Channel.ComputeSystemsReleaseTargets).add(
          job.name,
          job.data,
          { delay: 500 },
        );
        return;
      }

      throw e;
    }
  },
);
