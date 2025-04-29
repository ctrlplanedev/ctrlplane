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
  resourceSelector: ResourceCondition | null,
) =>
  tx
    .select()
    .from(SCHEMA.resource)
    .where(
      and(
        eq(SCHEMA.resource.id, resourceId),
        SCHEMA.resourceMatchesMetadata(tx, resourceSelector),
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
      getMatchedResource(tx, resourceId, value.resourceSelector).then(
        (matchedResource) => (matchedResource != null ? value : null),
      ),
    ),
  ).then((res) => res.find(isPresent));

/**
 * Resolves a reference value by following a path to extract a specific value
 * from a referenced resource or object.
 *
 * @param tx Database transaction
 * @param reference The identifier of the referenced resource
 * @param path Array of keys to traverse in the referenced object
 * @returns The resolved value or null if the reference or path is invalid
 */
export const resolveDeploymentVariableReference = async <T = unknown>(
  tx: Tx,
  reference: string,
  path: string[],
): Promise<T | null> => {
  // Get the referenced resource by its identifier
  const resource = await tx
    .select()
    .from(SCHEMA.resource)
    .where(
      and(
        eq(SCHEMA.resource.identifier, reference),
        isNull(SCHEMA.resource.deletedAt),
      ),
    )
    .then(takeFirstOrNull);

  if (!resource) return null;

  // Start with the resource's config
  let currentValue: unknown = resource.config;

  // Traverse the path to extract the value
  for (const key of path) {
    if (currentValue == null || typeof currentValue !== "object") {
      return null; // Path traversal failed
    }

    currentValue = (currentValue as Record<string, unknown>)[key];
  }

  return currentValue as T;
};

/**
 * Gets a deployment variable value by its ID and checks if it's a reference type
 *
 * @param tx Database transaction
 * @param variableValueId The ID of the variable value to retrieve
 * @returns The variable value object
 */
export const getDeploymentVariableValueById = (
  tx: Tx,
  variableValueId: string,
) =>
  tx
    .select()
    .from(SCHEMA.deploymentVariableValue)
    .where(eq(SCHEMA.deploymentVariableValue.id, variableValueId))
    .then(takeFirstOrNull);
