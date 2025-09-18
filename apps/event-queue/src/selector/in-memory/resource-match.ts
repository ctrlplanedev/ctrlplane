import type * as schema from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";

import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import { ResourceConditionType } from "@ctrlplane/validators/resources";

import {
  DateConditionOperatorFn,
  StringConditionOperatorFn,
} from "./common.js";

export const resourceMatchesSelector = (
  resource: schema.Resource,
  selector: ResourceCondition,
): boolean => {
  if (selector.type === ResourceConditionType.Id)
    return resource.id === selector.value;

  if (selector.type === ResourceConditionType.Name)
    return StringConditionOperatorFn[selector.operator](
      resource.name,
      selector.value,
    );

  if (selector.type === ResourceConditionType.Identifier)
    return StringConditionOperatorFn[selector.operator](
      resource.identifier,
      selector.value,
    );

  if (selector.type === ResourceConditionType.Kind)
    return resource.kind === selector.value;

  if (selector.type === ResourceConditionType.Version)
    return resource.version === selector.value;

  if (selector.type === ResourceConditionType.Provider)
    return resource.providerId === selector.value;

  if (selector.type === ConditionType.CreatedAt)
    return DateConditionOperatorFn[selector.operator](
      resource.createdAt,
      new Date(selector.value),
    );

  if (selector.type === ResourceConditionType.LastSync) {
    if (resource.updatedAt == null) return false;
    return DateConditionOperatorFn[selector.operator](
      resource.updatedAt,
      new Date(selector.value),
    );
  }

  if (selector.type === ResourceConditionType.Metadata) return false;

  if (selector.conditions.length === 0) return false;

  const subCon = selector.conditions.map((c) =>
    resourceMatchesSelector(resource, c),
  );
  if (selector.operator === ComparisonOperator.And)
    return subCon.every((c) => c);
  return subCon.some((c) => c);
};
