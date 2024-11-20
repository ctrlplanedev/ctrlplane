import type { Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { isPresent } from "ts-is-present";

import { and, eq, isNull, takeFirstOrNull } from "@ctrlplane/db";
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
    .from(SCHEMA.resource)
    .where(
      and(eq(SCHEMA.resource.id, targetId), isNull(SCHEMA.resource.deletedAt)),
    )
    .then(takeFirstOrNull);

export const getEnvironment = (tx: Tx, environmentId: string) =>
  tx.query.environment.findFirst({
    where: eq(SCHEMA.environment.id, environmentId),
    with: {
      environments: { with: { variableSet: { with: { values: true } } } },
    },
  });

export const getTargetVariableValue = (tx: Tx, targetId: string, key: string) =>
  tx
    .select()
    .from(SCHEMA.resourceVariable)
    .where(
      and(
        eq(SCHEMA.resourceVariable.resourceId, targetId),
        eq(SCHEMA.resourceVariable.key, key),
      ),
    )
    .then(takeFirstOrNull);

export const getVariableValues = (tx: Tx, variableId: string) =>
  tx
    .select()
    .from(SCHEMA.deploymentVariableValue)
    .orderBy(SCHEMA.deploymentVariableValue.value)
    .where(eq(SCHEMA.deploymentVariableValue.variableId, variableId));

export const getMatchedTarget = (
  tx: Tx,
  targetId: string,
  targetFilter: ResourceCondition | null,
) =>
  tx
    .select()
    .from(SCHEMA.resource)
    .where(
      and(
        eq(SCHEMA.resource.id, targetId),
        SCHEMA.resourceMatchesMetadata(tx, targetFilter),
        isNull(SCHEMA.resource.deletedAt),
      ),
    )
    .then(takeFirstOrNull);

export const getFirstMatchedTarget = (
  tx: Tx,
  targetId: string,
  values: SCHEMA.DeploymentVariableValue[],
) =>
  Promise.all(
    values.map((value) =>
      getMatchedTarget(tx, targetId, value.resourceFilter).then(
        (matchedTarget) => (matchedTarget != null ? value : null),
      ),
    ),
  ).then((res) => res.find(isPresent));
