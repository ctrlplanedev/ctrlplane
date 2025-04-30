import type { Tx } from "@ctrlplane/db";

import { and, eq, selector, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

const findMatchingDeployments = async (
  tx: Tx,
  policyTarget: schema.PolicyTarget,
  workspaceId: string,
) => {
  if (policyTarget.deploymentSelector == null) return [];
  const deployments = await tx
    .select()
    .from(schema.deployment)
    .innerJoin(schema.system, eq(schema.deployment.systemId, schema.system.id))
    .where(
      and(
        eq(schema.system.workspaceId, workspaceId),
        selector()
          .query()
          .deployments()
          .where(policyTarget.deploymentSelector)
          .sql(),
      ),
    );
  return deployments.map((d) => ({
    policyTargetId: policyTarget.id,
    deploymentId: d.deployment.id,
  }));
};

export const computePolicyTargetDeploymentSelectorWorker = createWorker(
  Channel.ComputePolicyTargetDeploymentSelector,
  async (job) => {
    const { id } = job.data;

    const policyTarget = await db.query.policyTarget.findFirst({
      where: eq(schema.policyTarget.id, id),
      with: { policy: true },
    });

    if (policyTarget == null) throw new Error("Policy target not found");

    const { policy } = policyTarget;
    const { workspaceId } = policy;

    try {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`
            SELECT * from ${schema.computedPolicyTargetDeployment}
            WHERE ${eq(schema.computedPolicyTargetDeployment.policyTargetId, policyTarget.id)}
            FOR UPDATE NOWAIT
          `,
        );

        await tx
          .delete(schema.computedPolicyTargetDeployment)
          .where(
            eq(
              schema.computedPolicyTargetDeployment.policyTargetId,
              policyTarget.id,
            ),
          );

        const matchingDeployments = await findMatchingDeployments(
          tx,
          policyTarget,
          workspaceId,
        );

        if (matchingDeployments.length === 0) return;
        await tx
          .insert(schema.computedPolicyTargetDeployment)
          .values(matchingDeployments)
          .onConflictDoNothing();
      });
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      if (isRowLocked) {
        await getQueue(Channel.ComputePolicyTargetDeploymentSelector).add(
          job.name,
          job.data,
        );
        return;
      }

      throw e;
    }
  },
);
