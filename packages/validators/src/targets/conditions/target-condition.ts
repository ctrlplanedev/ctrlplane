import { z } from "zod";

import type { ComparisonCondition } from "./comparison-condition.js";
import type { KindCondition } from "./kind-condition.js";
import type { MetadataCondition } from "./metadata-condition.js";
import type { NameCondition } from "./name-condition.js";
import { comparisonCondition } from "./comparison-condition.js";
import { kindCondition } from "./kind-condition.js";
import { metadataCondition } from "./metadata-condition.js";
import { nameCondition } from "./name-condition.js";

export type TargetCondition =
  | ComparisonCondition
  | MetadataCondition
  | KindCondition
  | NameCondition;

export const targetCondition = z.union([
  comparisonCondition,
  metadataCondition,
  kindCondition,
  nameCondition,
]);

export enum TargetOperator {
  Equals = "equals",
  Like = "like",
  Regex = "regex",
  Null = "null",
  And = "and",
  Or = "or",
}

export enum TargetFilterType {
  Metadata = "metadata",
  Kind = "kind",
  Name = "name",
  Comparison = "comparison",
}

export const defaultCondition: TargetCondition = {
  type: TargetFilterType.Comparison,
  operator: TargetOperator.And,
  conditions: [],
};

export const isDefaultCondition = (condition: TargetCondition): boolean => {
  return (
    condition.type === TargetFilterType.Comparison &&
    condition.operator === TargetOperator.And &&
    condition.conditions.length === 0
  );
};

export const isComparisonCondition = (
  condition: TargetCondition,
): condition is ComparisonCondition =>
  condition.type === TargetFilterType.Comparison;

export const MAX_DEPTH_ALLOWED = 2; // 0 indexed

// Check if converting to a comparison condition will exceed the max depth
// including any nested conditions
export const doesConvertingToComparisonRespectMaxDepth = (
  depth: number,
  condition: TargetCondition,
): boolean => {
  if (depth > MAX_DEPTH_ALLOWED) return false;
  if (isComparisonCondition(condition)) {
    if (depth === MAX_DEPTH_ALLOWED) return false;
    return condition.conditions.every((c) =>
      doesConvertingToComparisonRespectMaxDepth(depth + 1, c),
    );
  }
  return true;
};

export const isMetadataCondition = (
  condition: TargetCondition,
): condition is MetadataCondition =>
  condition.type === TargetFilterType.Metadata;

export const isKindCondition = (
  condition: TargetCondition,
): condition is KindCondition => condition.type === TargetFilterType.Kind;

export const isNameCondition = (
  condition: TargetCondition,
): condition is NameCondition => condition.type === TargetFilterType.Name;

export const isValidTargetCondition = (condition: TargetCondition): boolean => {
  // a default condition is valid - it means the user wants to clear the filter
  // so it gets set to undefined, which matches all targets
  if (isDefaultCondition(condition)) return true;
  if (isComparisonCondition(condition)) {
    if (condition.conditions.length === 0) return false;
    return condition.conditions.every((c) => isValidTargetCondition(c));
  }
  if (isKindCondition(condition)) return condition.value.length > 0;
  if (isNameCondition(condition)) return condition.value.length > 0;
  if (isMetadataCondition(condition)) {
    if (condition.operator === TargetOperator.Null)
      return condition.value == null && condition.key.length > 0;
    return condition.value.length > 0 && condition.key.length > 0;
  }
  return false;
};