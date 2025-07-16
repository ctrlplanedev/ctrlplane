import { and, eq, notInArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { computePolicyTargets } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, dispatchQueueJob } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

const log = logger.child({ module: "compute-workspace-policy-targets" });

const getPolicyTargets = async (
  workspaceId: string,
  processedPolicyTargetIds: string[],
) =>
  db
    .select()
    .from(schema.policyTarget)
    .innerJoin(
      schema.policy,
      eq(schema.policyTarget.policyId, schema.policy.id),
    )
    .where(
      and(
        eq(schema.policy.workspaceId, workspaceId),
        processedPolicyTargetIds.length > 0
          ? notInArray(schema.policyTarget.id, processedPolicyTargetIds)
          : undefined,
      ),
    );

export const computeWorkspacePolicyTargetsWorker = createWorker(
  Channel.ComputeWorkspacePolicyTargets,
  async (job) => {
    const { workspaceId, processedPolicyTargetIds, releaseTargetsToEvaluate } =
      job.data;

    const policyTargets = await getPolicyTargets(
      workspaceId,
      processedPolicyTargetIds ?? [],
    );

    if (policyTargets.length === 0) {
      if (releaseTargetsToEvaluate != null)
        await dispatchQueueJob()
          .toEvaluate()
          .releaseTargets(releaseTargetsToEvaluate);
      return;
    }

    const additionalProcessedPolicyTargetIds: string[] = [];

    for (const { policy_target: policyTarget } of policyTargets) {
      try {
        await computePolicyTargets(db, policyTarget);
        additionalProcessedPolicyTargetIds.push(policyTarget.id);
      } catch (e: any) {
        const isRowLockError = e.code === "55P03";
        if (!isRowLockError) {
          log.error("Failed to compute policy targets", { error: e });
          throw e;
        }

        await dispatchQueueJob()
          .toCompute()
          .workspace(workspaceId)
          .policyTargets({
            releaseTargetsToEvaluate,
            processedPolicyTargetIds: [
              ...(processedPolicyTargetIds ?? []),
              ...additionalProcessedPolicyTargetIds,
            ],
          });
        return;
      }
    }

    if (releaseTargetsToEvaluate != null)
      await dispatchQueueJob()
        .toEvaluate()
        .releaseTargets(releaseTargetsToEvaluate);
  },
);
