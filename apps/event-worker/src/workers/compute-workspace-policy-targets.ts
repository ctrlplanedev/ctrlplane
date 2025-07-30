import type { Tx } from "@ctrlplane/db";

import { and, eq, inArray, isNull, selector, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, dispatchQueueJob } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

const log = logger.child({ module: "compute-workspace-policy-targets" });

const getPolicyTargets = async (tx: Tx, workspaceId: string) =>
  tx
    .select()
    .from(schema.policyTarget)
    .innerJoin(
      schema.policy,
      eq(schema.policyTarget.policyId, schema.policy.id),
    )
    .where(eq(schema.policy.workspaceId, workspaceId));

const findMatchingReleaseTargets = (
  tx: Tx,
  policyTarget: schema.PolicyTarget,
) =>
  tx
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseTarget.environmentId, schema.environment.id),
    )
    .where(
      and(
        isNull(schema.resource.deletedAt),
        selector()
          .query()
          .resources()
          .where(policyTarget.resourceSelector)
          .sql(),
        selector()
          .query()
          .deployments()
          .where(policyTarget.deploymentSelector)
          .sql(),
        selector()
          .query()
          .environments()
          .where(policyTarget.environmentSelector)
          .sql(),
      ),
    )
    .then((rt) =>
      rt.map((rt) => ({
        policyTargetId: policyTarget.id,
        releaseTargetId: rt.release_target.id,
      })),
    );

const acquireWorkspacePolicyTargetsLock = async (tx: Tx, workspaceId: string) =>
  tx.execute(
    sql`
    SELECT * FROM ${schema.policyTarget}
    INNER JOIN ${schema.policy} ON ${eq(schema.policyTarget.policyId, schema.policy.id)}
    WHERE ${eq(schema.policy.workspaceId, workspaceId)}
    FOR UPDATE NOWAIT
  `,
  );

const maybeAcquireReleaseTargetsLock = async (
  tx: Tx,
  releaseTargets?: schema.ReleaseTarget[],
) => {
  const releaseTargetsIds = releaseTargets?.map((rt) => rt.id) ?? [];
  if (releaseTargetsIds.length === 0) return;

  await tx.execute(
    sql`
    SELECT * FROM ${schema.releaseTarget}
    WHERE ${inArray(schema.releaseTarget.id, releaseTargetsIds)}
    FOR UPDATE NOWAIT
  `,
  );
};

const computePolicyTarget = async (
  tx: Tx,
  policyTarget: schema.PolicyTarget,
) => {
  const previous = await tx
    .select()
    .from(schema.computedPolicyTargetReleaseTarget)
    .where(
      eq(
        schema.computedPolicyTargetReleaseTarget.policyTargetId,
        policyTarget.id,
      ),
    );

  const releaseTargets = await findMatchingReleaseTargets(tx, policyTarget);

  const prevIds = new Set(previous.map((rt) => rt.releaseTargetId));
  const nextIds = new Set(releaseTargets.map((rt) => rt.releaseTargetId));
  const deleted = previous.filter((rt) => !nextIds.has(rt.releaseTargetId));
  const created = releaseTargets.filter(
    (rt) => !prevIds.has(rt.releaseTargetId),
  );

  if (deleted.length > 0)
    await tx.delete(schema.computedPolicyTargetReleaseTarget).where(
      inArray(
        schema.computedPolicyTargetReleaseTarget.releaseTargetId,
        deleted.map((rt) => rt.releaseTargetId),
      ),
    );

  if (created.length > 0)
    await tx
      .insert(schema.computedPolicyTargetReleaseTarget)
      .values(created)
      .onConflictDoNothing();

  return [...created, ...deleted].map((rt) => rt.releaseTargetId);
};

export const computeWorkspacePolicyTargetsWorker = createWorker(
  Channel.ComputeWorkspacePolicyTargets,
  async (job) => {
    const { workspaceId, releaseTargetsToEvaluate } = job.data;

    try {
      await db.transaction(async (tx) => {
        await maybeAcquireReleaseTargetsLock(tx, releaseTargetsToEvaluate);
        await acquireWorkspacePolicyTargetsLock(tx, workspaceId);

        const policyTargets = await getPolicyTargets(tx, workspaceId);
        if (policyTargets.length === 0) return;

        for (const { policy_target: policyTarget } of policyTargets)
          await computePolicyTarget(tx, policyTarget);
      });
    } catch (e: any) {
      const isRowLockError = e.code === "55P03";
      if (isRowLockError) {
        dispatchQueueJob().toCompute().workspace(workspaceId).policyTargets({
          releaseTargetsToEvaluate,
        });
        return;
      }

      log.error("Failed to compute workspace policy targets", { error: e });
      throw e;
    }

    if (releaseTargetsToEvaluate != null)
      await dispatchQueueJob()
        .toEvaluate()
        .releaseTargets(releaseTargetsToEvaluate);
  },
);
