import type { Tx } from "@ctrlplane/db";
import type { TargetCondition } from "@ctrlplane/validators/targets";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

export const getJob = (tx: Tx, jobId: string) =>
  tx
    .select()
    .from(SCHEMA.job)
    .innerJoin(
      SCHEMA.releaseJobTrigger,
      eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
    )
    .where(eq(SCHEMA.job.id, jobId))
    .then(takeFirstOrNull);

export const getDeploymentVariables = (tx: Tx, releaseId: string) =>
  tx
    .select()
    .from(SCHEMA.deploymentVariable)
    .innerJoin(
      SCHEMA.release,
      eq(SCHEMA.release.deploymentId, SCHEMA.deploymentVariable.deploymentId),
    )
    .where(eq(SCHEMA.release.id, releaseId));

export const getTarget = (tx: Tx, targetId: string) =>
  tx
    .select()
    .from(SCHEMA.target)
    .where(eq(SCHEMA.target.id, targetId))
    .then(takeFirstOrNull);

export const getEnvironment = (tx: Tx, environmentId: string) =>
  tx.query.environment.findMany({
    where: eq(SCHEMA.environment.id, environmentId),
    with: {
      assignments: {
        with: { variableSet: { with: { values: true } } },
        orderBy: SCHEMA.environment.name,
      },
    },
  });

export const getVariableValues = (tx: Tx, variableId: string) =>
  tx
    .select()
    .from(SCHEMA.deploymentVariableValue)
    .orderBy(SCHEMA.deploymentVariableValue.value)
    .where(eq(SCHEMA.deploymentVariableValue.variableId, variableId));

export const getMatchedTarget = (
  tx: Tx,
  targetId: string,
  targetFilter: TargetCondition | null,
) =>
  tx
    .select()
    .from(SCHEMA.target)
    .where(
      and(
        eq(SCHEMA.target.id, targetId),
        SCHEMA.targetMatchesMetadata(tx, targetFilter),
      ),
    )
    .then(takeFirstOrNull);

export const getFirstMatchedTarget = (
  tx: Tx,
  targetId: string,
  values: SCHEMA.DeploymentVariableValue[],
) => {
  const promise = values.map(async (value) => {
    const matchedTarget = await getMatchedTarget(
      tx,
      targetId,
      value.targetFilter,
    );
    return matchedTarget != null ? value : null;
  });

  return Promise.all(promise).then(takeFirstOrNull);
};
