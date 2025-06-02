import { asc, eq } from "drizzle-orm";

import { variablesAES256 } from "@ctrlplane/secrets";

import type { Tx } from "../../common.js";
import * as schema from "../../schema/index.js";

export const getResolvedDirectValue = (
  directValue: schema.DirectDeploymentVariableValue,
) => {
  const { value, sensitive } = directValue;
  if (!sensitive) return value;

  const strVal =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return variablesAES256().decrypt(strVal);
};

const getDirectValues = async (tx: Tx, variable: schema.DeploymentVariable) => {
  const directValues = await tx
    .select()
    .from(schema.deploymentVariableValue)
    .innerJoin(
      schema.deploymentVariableValueDirect,
      eq(
        schema.deploymentVariableValue.id,
        schema.deploymentVariableValueDirect.variableValueId,
      ),
    )
    .where(eq(schema.deploymentVariableValue.variableId, variable.id));

  return directValues.map((v) => {
    const {
      deployment_variable_value_direct: directValue,
      deployment_variable_value: variableValue,
    } = v;

    return { ...directValue, ...variableValue };
  });
};

const getReferenceValues = async (
  tx: Tx,
  variable: schema.DeploymentVariable,
) => {
  const referenceValues = await tx
    .select()
    .from(schema.deploymentVariableValue)
    .innerJoin(
      schema.deploymentVariableValueReference,
      eq(
        schema.deploymentVariableValue.id,
        schema.deploymentVariableValueReference.variableValueId,
      ),
    )
    .where(eq(schema.deploymentVariableValue.variableId, variable.id))
    .orderBy(asc(schema.deploymentVariableValueReference.reference));

  return referenceValues.map((v) => {
    const {
      deployment_variable_value_reference: referenceValue,
      deployment_variable_value: variableValue,
    } = v;
    return { ...referenceValue, ...variableValue };
  });
};

const getVariableValues = async (
  tx: Tx,
  variable: schema.DeploymentVariable,
) => {
  const [directValues, referenceValues] = await Promise.all([
    getDirectValues(tx, variable),
    getReferenceValues(tx, variable),
  ]);

  return { directValues, referenceValues };
};

export const getDeploymentVariables = async (tx: Tx, deploymentId: string) => {
  const variables = await tx
    .select()
    .from(schema.deploymentVariable)
    .where(eq(schema.deploymentVariable.deploymentId, deploymentId))
    .orderBy(asc(schema.deploymentVariable.key));

  const variablesWithValues = await Promise.all(
    variables.map(async (v) => {
      const { defaultValueId } = v;
      const { directValues, referenceValues } = await getVariableValues(tx, v);
      const defaultValue = [...directValues, ...referenceValues].find(
        (v) => v.id === defaultValueId,
      );
      return { ...v, directValues, referenceValues, defaultValue };
    }),
  );

  return variablesWithValues;
};
