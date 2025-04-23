import type { Tx } from "@ctrlplane/db";
import ms from "ms";

import { and, eq, inArray, isNull, or } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { withMutex } from "../utils/with-mutex.js";

const findMatchingEnvironmentDeploymentPairs = (
  tx: Tx,
  workspaceId: string,
) => {
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
        eq(schema.resource.workspaceId, workspaceId),
        isNull(schema.resource.deletedAt),
      ),
    );
};

export const computeSystemsReleaseTargetsWorker = createWorker(
  Channel.ComputeSystemsReleaseTargets,
  async (job) => {
    const system = await db.query.system.findFirst({
      where: eq(schema.system.id, job.data.id),
      with: { deployments: true, environments: true },
    });

    if (system == null) throw new Error("System not found");

    const { deployments, environments } = system;
    const deploymentIds = deployments.map((d) => d.id);
    const environmentIds = environments.map((e) => e.id);
    const { workspaceId } = system;

    const key = `${Channel.ComputeSystemsReleaseTargets}:${system.id}`;
    const [acquired, createdReleaseTargets] = await withMutex(key, () =>
      db.transaction(async (tx) => {
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
          workspaceId,
        );

        await tx.insert(schema.releaseTarget).values(releaseTargets);

        const deleted = previousReleaseTargets.filter(
          (rt) =>
            !releaseTargets.some(
              (newRt) =>
                newRt.deploymentId === rt.deploymentId &&
                newRt.resourceId === rt.resourceId,
            ),
        );

        const created = releaseTargets.filter(
          (rt) =>
            !previousReleaseTargets.some(
              (prevRt) =>
                prevRt.deploymentId === rt.deploymentId &&
                prevRt.resourceId === rt.resourceId,
            ),
        );

        return { deleted, created };
      }),
    );

    if (!acquired) {
      await getQueue(Channel.ComputeSystemsReleaseTargets).add(
        job.name,
        job.data,
        { delay: ms("1s"), jobId: job.id },
      );
      return;
    }

    if (createdReleaseTargets == null) return;
    if (createdReleaseTargets.created.length === 0) return;

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
        { delay: ms("500ms"), jobId: policyTarget.id },
      );
    }
  },
);
