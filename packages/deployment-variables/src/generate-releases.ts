import { and, asc, eq, isNotNull, takeFirstOrNull, Tx } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

/**
 * Get the variable directly assigned to the resource
 * @param db
 * @param resourceId
 * @param key
 * @returns the variable assigned to the resource for this key
 */
const getResourceVariable = async (db: Tx, resourceId: string, key: string) =>
  db
    .select()
    .from(SCHEMA.resourceVariable)
    .where(
      and(
        eq(SCHEMA.resourceVariable.key, key),
        eq(SCHEMA.resourceVariable.resourceId, resourceId),
      ),
    )
    .then(takeFirstOrNull);

/**
 * Get the variable value assigned to the deployment
 * To resolve conflicts, we sort the values by jsonb ascending and select the first
 * @param db
 * @param resourceId
 * @param deploymentId
 * @param key
 */
const getDeploymentVariableValue = async (
  db: Tx,
  resourceId: string,
  deploymentId: string,
  key: string,
) => {
  const variable = await db
    .select()
    .from(SCHEMA.deploymentVariable)
    .where(
      and(
        eq(SCHEMA.deploymentVariable.key, key),
        eq(SCHEMA.deploymentVariable.deploymentId, deploymentId),
      ),
    )
    .then(takeFirstOrNull);

  if (variable == null) return null;

  const values = await db
    .select()
    .from(SCHEMA.deploymentVariableValue)
    .where(eq(SCHEMA.deploymentVariableValue.variableId, variable.id))
    .orderBy(asc(SCHEMA.deploymentVariableValue.value));

  for (const value of values) {
    const resource = await db
      .select()
      .from(SCHEMA.resource)
      .where(
        and(
          eq(SCHEMA.resource.id, resourceId),
          SCHEMA.resourceMatchesMetadata(db, value.resourceSelector),
        ),
      )
      .then(takeFirstOrNull);

    if (resource != null) return value.value;
  }

  const defaultValue = values.find((v) => v.id === variable.defaultValueId);
  return defaultValue?.value ?? null;
};

/**
 * Get the variable value assigned to the environment via variable sets
 * To resolve conflicts, we sort the values by jsonb ascending and select the first
 * @param db
 * @param environmentId
 * @param key
 */
const getVariableSetValue = async (
  db: Tx,
  environmentId: string,
  key: string,
) =>
  db
    .select()
    .from(SCHEMA.variableSetValue)
    .innerJoin(
      SCHEMA.variableSetEnvironment,
      eq(
        SCHEMA.variableSetValue.variableSetId,
        SCHEMA.variableSetEnvironment.variableSetId,
      ),
    )
    .where(
      and(
        eq(SCHEMA.variableSetEnvironment.environmentId, environmentId),
        eq(SCHEMA.variableSetValue.key, key),
      ),
    )
    .orderBy(asc(SCHEMA.variableSetValue.value))
    .limit(1)
    .then(takeFirstOrNull);

/**
 *
 * @param db
 * @param resourceId
 * @param deploymentId
 * @param environmentId
 * @param key
 * @returns the value assigned to the resource for this key
 *
 * This function will deterministically assign a value to the resource
 * based on the following priority rule:
 *
 *  1. Check if there is a variable directly assigned to the resource
 *  2. Check if there is a deployment variable value who's resource selector
 *     matches the resource
 *       - If there are multiple, we sort by jsonb ascending and select the first
 *  3. Check if there is a value for this key in a variable set assigned to the environment
 *     - If there are multiple, we sort by jsonb ascending and select the first
 */
const getValueForResource = async (
  db: Tx,
  resourceId: string,
  deploymentId: string,
  environmentId: string,
  key: string,
) => {
  const resourceVariable = await getResourceVariable(db, resourceId, key);
  if (resourceVariable != null) return resourceVariable.value;

  const deploymentVariableValue = await getDeploymentVariableValue(
    db,
    resourceId,
    deploymentId,
    key,
  );
  if (deploymentVariableValue != null) return deploymentVariableValue;

  const variableSetValue = await getVariableSetValue(db, environmentId, key);
  return variableSetValue;
};
