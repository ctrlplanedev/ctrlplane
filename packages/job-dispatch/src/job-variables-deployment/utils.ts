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
      SCHEMA.deploymentVersion,
      eq(
        SCHEMA.deploymentVersion.deploymentId,
        SCHEMA.deploymentVariable.deploymentId,
      ),
    )
    .where(eq(SCHEMA.deploymentVersion.id, releaseId));

export const getResource = (tx: Tx, resourceId: string) =>
  tx
    .select()
    .from(SCHEMA.resource)
    .where(
      and(
        eq(SCHEMA.resource.id, resourceId),
        isNull(SCHEMA.resource.deletedAt),
      ),
    )
    .then(takeFirstOrNull);

export const getEnvironment = (tx: Tx, environmentId: string) =>
  tx.query.environment.findFirst({
    where: eq(SCHEMA.environment.id, environmentId),
    with: {
      environments: { with: { variableSet: { with: { values: true } } } },
    },
  });

export const getResourceVariableValue = (
  tx: Tx,
  resourceId: string,
  key: string,
) =>
  tx
    .select()
    .from(SCHEMA.resourceVariable)
    .where(
      and(
        eq(SCHEMA.resourceVariable.resourceId, resourceId),
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

export const getMatchedResource = (
  tx: Tx,
  resourceId: string,
  resourceFilter: ResourceCondition | null,
) =>
  tx
    .select()
    .from(SCHEMA.resource)
    .where(
      and(
        eq(SCHEMA.resource.id, resourceId),
        SCHEMA.resourceMatchesMetadata(tx, resourceFilter),
        isNull(SCHEMA.resource.deletedAt),
      ),
    )
    .then(takeFirstOrNull);

export const getFirstMatchedResource = (
  tx: Tx,
  resourceId: string,
  values: SCHEMA.DeploymentVariableValue[],
) =>
  Promise.all(
    values.map((value) =>
      getMatchedResource(tx, resourceId, value.resourceFilter).then(
        (matchedResource) => (matchedResource != null ? value : null),
      ),
    ),
  ).then((res) => res.find(isPresent));
