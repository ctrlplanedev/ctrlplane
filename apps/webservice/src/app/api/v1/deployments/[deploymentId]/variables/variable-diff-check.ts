import _ from "lodash";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

type DeploymentVariable = schema.DeploymentVariable & {
  directValues: schema.DirectDeploymentVariableValue[];
  referenceValues: schema.ReferenceDeploymentVariableValue[];
};

const getVariable = async (deploymentId: string, key: string) =>
  dbClient
    .select()
    .from(schema.deploymentVariable)
    .where(
      and(
        eq(schema.deploymentVariable.deploymentId, deploymentId),
        eq(schema.deploymentVariable.key, key),
      ),
    )
    .then(takeFirstOrNull);

const getDirectValues = async (
  variableId: string,
): Promise<schema.DirectDeploymentVariableValue[]> =>
  dbClient
    .select()
    .from(schema.deploymentVariableValue)
    .innerJoin(
      schema.deploymentVariableValueDirect,
      eq(
        schema.deploymentVariableValueDirect.variableValueId,
        schema.deploymentVariableValue.id,
      ),
    )
    .where(eq(schema.deploymentVariableValue.variableId, variableId))
    .then((rows) =>
      rows.map((r) => ({
        ...r.deployment_variable_value_direct,
        ...r.deployment_variable_value,
      })),
    );

const getReferenceValues = async (
  variableId: string,
): Promise<schema.ReferenceDeploymentVariableValue[]> =>
  dbClient
    .select()
    .from(schema.deploymentVariableValue)
    .innerJoin(
      schema.deploymentVariableValueReference,
      eq(
        schema.deploymentVariableValueReference.variableValueId,
        schema.deploymentVariableValue.id,
      ),
    )
    .where(eq(schema.deploymentVariableValue.variableId, variableId))
    .then((rows) =>
      rows.map((r) => ({
        ...r.deployment_variable_value_reference,
        ...r.deployment_variable_value,
      })),
    );

export const getExistingVariable = async (
  deploymentId: string,
  key: string,
) => {
  const variable = await getVariable(deploymentId, key);
  if (variable == null) return null;

  const [directValues, referenceValues] = await Promise.all([
    getDirectValues(variable.id),
    getReferenceValues(variable.id),
  ]);

  return { ...variable, directValues, referenceValues };
};

const isAnyDirectValuesChanged = (
  existingDirectValues: schema.DirectDeploymentVariableValue[],
  newDirectValues: schema.DirectDeploymentVariableValue[],
) => {
  if (existingDirectValues.length !== newDirectValues.length) return true;

  for (const newDirectValue of newDirectValues) {
    const existingDirectValue = existingDirectValues.find(
      (existingDirectValue) =>
        existingDirectValue.valueHash === newDirectValue.valueHash,
    );
    if (existingDirectValue == null) return true;

    const existingWithoutId = _.omit(existingDirectValue, "id", "isDefault");
    const newWithoutId = _.omit(newDirectValue, "id", "isDefault");

    const isChanged = !_.isEqual(existingWithoutId, newWithoutId);
    if (isChanged) return true;
  }

  return false;
};

const isAnyReferenceValuesChanged = (
  existingReferenceValues: schema.ReferenceDeploymentVariableValue[],
  newReferenceValues: schema.ReferenceDeploymentVariableValue[],
) => {
  if (existingReferenceValues.length !== newReferenceValues.length) return true;

  for (const newReferenceValue of newReferenceValues) {
    const existingReferenceValue = existingReferenceValues.find(
      (existingReferenceValue) => {
        const newReferenceValueWithoutId = _.omit(
          newReferenceValue,
          "id",
          "isDefault",
        );
        const existingReferenceValueWithoutId = _.omit(
          existingReferenceValue,
          "id",
          "isDefault",
        );
        return _.isEqual(
          newReferenceValueWithoutId,
          existingReferenceValueWithoutId,
        );
      },
    );

    if (existingReferenceValue == null) return true;
  }

  return false;
};

export const isVariableChanged = (
  exisstingVariable: DeploymentVariable,
  newVariable: DeploymentVariable,
) => {
  const {
    directValues: existingDirectValues,
    referenceValues: existingReferenceValues,
    ...existingBaseVariable
  } = exisstingVariable;
  const {
    directValues: newDirectValues,
    referenceValues: newReferenceValues,
    ...newBaseVariable
  } = newVariable;

  const isBaseVariableChanged = !_.isEqual(
    existingBaseVariable,
    newBaseVariable,
  );
  if (isBaseVariableChanged) return true;

  const isDirectValuesChanged = isAnyDirectValuesChanged(
    existingDirectValues,
    newDirectValues,
  );
  if (isDirectValuesChanged) return true;

  const isReferenceValuesChanged = isAnyReferenceValuesChanged(
    existingReferenceValues,
    newReferenceValues,
  );
  if (isReferenceValuesChanged) return true;

  return false;
};
