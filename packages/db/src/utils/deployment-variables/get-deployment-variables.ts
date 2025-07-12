import { asc, desc, eq } from "drizzle-orm";
import { isPresent } from "ts-is-present";

import { logger } from "@ctrlplane/logger";

import type { Tx } from "../../common.js";
import * as schema from "../../schema/index.js";

const log = logger.child({ module: "get-deployment-variables" });

type VariableValueDbResult = {
  deployment_variable_value: typeof schema.deploymentVariableValue.$inferSelect;
  deployment_variable_value_direct:
    | typeof schema.deploymentVariableValueDirect.$inferSelect
    | null;
  deployment_variable_value_reference:
    | typeof schema.deploymentVariableValueReference.$inferSelect
    | null;
};

const formatVariableValueDbResult = (
  result: VariableValueDbResult,
): schema.DeploymentVariableValue | null => {
  if (result.deployment_variable_value_direct != null)
    return {
      ...result.deployment_variable_value_direct,
      ...result.deployment_variable_value,
    };

  if (result.deployment_variable_value_reference != null)
    return {
      ...result.deployment_variable_value_reference,
      ...result.deployment_variable_value,
    };

  log.error("Found variable value with no direct or reference value", {
    variableValueId: result.deployment_variable_value.id,
  });
  return null;
};

const getVariableValues = async (
  tx: Tx,
  variable: schema.DeploymentVariable,
) => {
  const variableValueResults = await tx
    .select()
    .from(schema.deploymentVariableValue)
    .leftJoin(
      schema.deploymentVariableValueDirect,
      eq(
        schema.deploymentVariableValue.id,
        schema.deploymentVariableValueDirect.variableValueId,
      ),
    )
    .leftJoin(
      schema.deploymentVariableValueReference,
      eq(
        schema.deploymentVariableValue.id,
        schema.deploymentVariableValueReference.variableValueId,
      ),
    )
    .where(eq(schema.deploymentVariableValue.variableId, variable.id))
    .orderBy(desc(schema.deploymentVariableValue.priority));

  return variableValueResults
    .map(formatVariableValueDbResult)
    .filter(isPresent);
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
      const values = await getVariableValues(tx, v);
      const defaultValue = values.find((v) => v.id === defaultValueId);
      return { ...v, values, defaultValue };
    }),
  );

  return variablesWithValues;
};
