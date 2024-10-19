import type { Tx } from "@ctrlplane/db";
import type { TargetCondition } from "@ctrlplane/validators/targets";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

export const getJob = (tx: Tx, jobId: string) =>
  tx
    .select()
    .from(schema.job)
    .innerJoin(
      schema.releaseJobTrigger,
      eq(schema.releaseJobTrigger.jobId, schema.job.id),
    )
    .where(eq(schema.job.id, jobId))
    .then(takeFirstOrNull);

export const getDeploymentVariables = (tx: Tx, releaseId: string) =>
  tx
    .select()
    .from(schema.deploymentVariable)
    .innerJoin(
      schema.release,
      eq(schema.release.deploymentId, schema.deploymentVariable.deploymentId),
    )
    .where(eq(schema.release.id, releaseId));

export const getTarget = (tx: Tx, targetId: string) =>
  tx
    .select()
    .from(schema.target)
    .where(eq(schema.target.id, targetId))
    .then(takeFirstOrNull);

export const getEnvironment = (tx: Tx, environmentId: string) =>
  tx.query.environment.findMany({
    where: eq(schema.environment.id, environmentId),
    with: {
      assignments: { with: { variableSet: { with: { values: true } } } },
    },
  });

export const getVariableValues = (tx: Tx, variableId: string) =>
  tx
    .select()
    .from(schema.deploymentVariableValue)
    .orderBy(schema.deploymentVariableValue.value)
    .where(eq(schema.deploymentVariableValue.variableId, variableId));

export const getMatchedTarget = (
  tx: Tx,
  targetId: string,
  targetFilter: TargetCondition | null,
) =>
  tx
    .select()
    .from(schema.target)
    .where(
      and(
        eq(schema.target.id, targetId),
        schema.targetMatchesMetadata(tx, targetFilter),
      ),
    )
    .then(takeFirstOrNull);
