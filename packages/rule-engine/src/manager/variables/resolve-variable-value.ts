import type { Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";

import { and, eq, selector } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { variablesAES256 } from "@ctrlplane/secrets";

import {
  getReferenceVariableValue,
  getReferenceVariableValueDb,
} from "./resolve-reference-variable.js";

export const getResolvedDirectValue = (directValue: {
  value: string | number | boolean | object | null;
  sensitive: boolean;
}) => {
  const { value, sensitive } = directValue;
  if (!sensitive) return value;

  const strVal =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return variablesAES256().decrypt(strVal);
};

const getIsSelectingResource = async (
  db: Tx,
  resourceId: string,
  resourceSelector: ResourceCondition | null,
) => {
  if (resourceSelector == null) return false;

  const resourceMatch = await db.query.resource.findFirst({
    where: and(
      eq(schema.resource.id, resourceId),
      selector().query().resources().where(resourceSelector).sql(),
    ),
  });

  return resourceMatch != null;
};

/**
 *
 * @param db
 * @param resourceId
 * @param variableValue
 * @returns For a given resource and variable value, returns the resolved value if the variable value is selecting the resource, otherwise null
 */
export const resolveVariableValue = async (
  db: Tx,
  resourceId: string,
  variableValue: schema.DeploymentVariableValue,
  isDefault = false,
  inMemory = true,
) => {
  const isSelectingResource = isDefault
    ? true
    : await getIsSelectingResource(
        db,
        resourceId,
        variableValue.resourceSelector,
      );
  if (!isSelectingResource) return null;

  if (schema.isDeploymentVariableValueDirect(variableValue))
    return {
      value: getResolvedDirectValue(variableValue),
      sensitive: variableValue.sensitive,
    };

  const resolvedValue = inMemory
    ? await getReferenceVariableValue(resourceId, variableValue)
    : await getReferenceVariableValueDb(resourceId, variableValue);
  return {
    value: resolvedValue,
    sensitive: false,
  };
};
