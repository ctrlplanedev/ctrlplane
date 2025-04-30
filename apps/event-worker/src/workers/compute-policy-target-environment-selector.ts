import type { Tx } from "@ctrlplane/db";

import { and, eq, selector, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

const findMatchingEnvironments = async (
  tx: Tx,
  policyTarget: schema.PolicyTarget,
  workspaceId: string,
) => {
  if (policyTarget.environmentSelector == null) return [];
  const environments = await tx
    .select()
    .from(schema.environment)
    .innerJoin(schema.system, eq(schema.environment.systemId, schema.system.id))
    .where(
      and(
        eq(schema.system.workspaceId, workspaceId),
        selector()
          .query()
          .environments()
          .where(policyTarget.environmentSelector)
          .sql(),
      ),
    );
  return environments.map((e) => ({
    policyTargetId: policyTarget.id,
    environmentId: e.environment.id,
  }));
};

export const computePolicyTargetEnvironmentSelectorWorker = createWorker(
  Channel.ComputePolicyTargetEnvironmentSelector,
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
            SELECT * from ${schema.computedPolicyTargetEnvironment}
            WHERE ${eq(schema.computedPolicyTargetEnvironment.policyTargetId, policyTarget.id)}
            FOR UPDATE NOWAIT
          `,
        );

        await tx
          .delete(schema.computedPolicyTargetEnvironment)
          .where(
            eq(
              schema.computedPolicyTargetEnvironment.policyTargetId,
              policyTarget.id,
            ),
          );

        const matchingEnvironments = await findMatchingEnvironments(
          tx,
          policyTarget,
          workspaceId,
        );

        if (matchingEnvironments.length === 0) return;
        await tx
          .insert(schema.computedPolicyTargetEnvironment)
          .values(matchingEnvironments)
          .onConflictDoNothing();
      });
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      if (isRowLocked) {
        await getQueue(Channel.ComputePolicyTargetEnvironmentSelector).add(
          job.name,
          job.data,
        );
        return;
      }

      throw e;
    }
  },
);
