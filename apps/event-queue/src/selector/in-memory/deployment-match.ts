import type * as schema from "@ctrlplane/db/schema";
import type { DeploymentCondition } from "@ctrlplane/validators/deployments";

import { ComparisonOperator } from "@ctrlplane/validators/conditions";

import { StringConditionOperatorFn } from "./common.js";

export const deploymentMatchesSelector = (
  deployment: schema.Deployment,
  selector: DeploymentCondition,
): boolean => {
  if (selector.type === "name")
    return StringConditionOperatorFn[selector.operator](
      deployment.name,
      selector.value,
    );
  if (selector.type === "slug")
    return StringConditionOperatorFn[selector.operator](
      deployment.slug,
      selector.value,
    );
  if (selector.type === "system") return deployment.systemId === selector.value;
  if (selector.type === "id") return deployment.id === selector.value;

  if (selector.conditions.length === 0) return false;

  const subCon = selector.conditions.map((c) =>
    deploymentMatchesSelector(deployment, c),
  );
  const isConditionMet =
    selector.operator === ComparisonOperator.And
      ? subCon.every((c) => c)
      : subCon.some((c) => c);
  return selector.not ? !isConditionMet : isConditionMet;
};
