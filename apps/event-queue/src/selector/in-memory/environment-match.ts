import type * as schema from "@ctrlplane/db/schema";
import type { EnvironmentCondition } from "@ctrlplane/validators/environments";

import { ComparisonOperator } from "@ctrlplane/validators/conditions";

import { StringConditionOperatorFn } from "./common.js";

export const environmentMatchesSelector = (
  environment: schema.Environment,
  selector: EnvironmentCondition,
): boolean => {
  if (selector.type === "directory")
    return environment.directory === selector.value;
  if (selector.type === "name")
    return StringConditionOperatorFn[selector.operator](
      environment.name,
      selector.value,
    );
  if (selector.type === "system")
    return environment.systemId === selector.value;
  if (selector.type === "id") return environment.id === selector.value;
  if (selector.type === "metadata") return false;

  if (selector.conditions.length === 0) return false;

  const subCon = selector.conditions.map((c) =>
    environmentMatchesSelector(environment, c),
  );
  if (selector.operator === ComparisonOperator.And)
    return subCon.every((c) => c);
  return subCon.some((c) => c);
};
