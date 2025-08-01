import type { ResourceCondition } from "@ctrlplane/validators/resources";

import {
  ConditionType,
  MetadataOperator,
} from "@ctrlplane/validators/conditions";
import { ResourceConditionType } from "@ctrlplane/validators/resources";

import type { Resource } from "../entity-types.js";
import { DateComparisonFn, StringComparisonFn } from "./common.js";

export const isResourceMatchingCondition = (
  resource: Resource,
  condition: ResourceCondition | null,
): boolean => {
  if (condition == null) return false;

  if (condition.type === ResourceConditionType.Id)
    return resource.id === condition.value;
  if (condition.type === ResourceConditionType.Kind)
    return resource.kind === condition.value;
  if (condition.type === ResourceConditionType.Provider)
    return resource.providerId === condition.value;
  if (condition.type === ResourceConditionType.Version)
    return resource.version === condition.value;

  if (condition.type === ResourceConditionType.Identifier)
    return StringComparisonFn[condition.operator](
      resource.identifier,
      condition.value,
    );
  if (condition.type === ResourceConditionType.Name)
    return StringComparisonFn[condition.operator](
      resource.name,
      condition.value,
    );

  if (condition.type === ResourceConditionType.LastSync) {
    if (resource.updatedAt === null) return false;
    const date = new Date(condition.value);
    return DateComparisonFn[condition.operator](resource.updatedAt, date);
  }

  if (condition.type === ConditionType.CreatedAt) {
    const date = new Date(condition.value);
    return DateComparisonFn[condition.operator](resource.createdAt, date);
  }

  if (condition.type === ResourceConditionType.Metadata) {
    const entry = resource.metadata[condition.key];
    if (condition.operator === MetadataOperator.Null) return entry == null;
    if (condition.operator === undefined) return entry === condition.value;
    if (entry == null) return false;
    return StringComparisonFn[condition.operator](entry, condition.value);
  }

  const { conditions: subConditions } = condition;
  if (subConditions.length === 0) return false;
  const { not = false } = condition;

  const isSubconditionsMatching = subConditions.every((c) =>
    isResourceMatchingCondition(resource, c),
  );
  if (not) return !isSubconditionsMatching;
  return isSubconditionsMatching;
};
