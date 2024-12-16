import { z } from "zod";

import type {
  CreatedAtCondition,
  MetadataCondition,
} from "../../conditions/index.js";
import type { ComparisonCondition } from "./comparison-condition.js";
import type { IdentifierCondition } from "./identifier-condition.js";
import type { KindCondition } from "./kind-condition.js";
import type { NameCondition } from "./name-condition.js";
import type { ProviderCondition } from "./provider-condition.js";
import {
  createdAtCondition,
  FilterType,
  metadataCondition,
} from "../../conditions/index.js";
import { comparisonCondition } from "./comparison-condition.js";
import { identifierCondition } from "./identifier-condition.js";
import { kindCondition } from "./kind-condition.js";
import { nameCondition } from "./name-condition.js";
import { providerCondition } from "./provider-condition.js";

export type ResourceCondition =
  | ComparisonCondition
  | MetadataCondition
  | KindCondition
  | NameCondition
  | ProviderCondition
  | IdentifierCondition
  | CreatedAtCondition;

export const resourceCondition = z.union([
  comparisonCondition,
  metadataCondition,
  kindCondition,
  nameCondition,
  providerCondition,
  identifierCondition,
  createdAtCondition,
]);

export enum ResourceOperator {
  Equals = "equals",
  Like = "like",
  Regex = "regex",
  Null = "null",
  And = "and",
  Or = "or",
}

export enum ResourceFilterType {
  Metadata = "metadata",
  Kind = "kind",
  Name = "name",
  Identifier = "identifier",
  Provider = "provider",
  Comparison = "comparison",
}

export const defaultCondition: ResourceCondition = {
  type: ResourceFilterType.Comparison,
  operator: ResourceOperator.And,
  not: false,
  conditions: [],
};

export const isComparisonCondition = (
  condition: ResourceCondition,
): condition is ComparisonCondition =>
  condition.type === ResourceFilterType.Comparison;

export const MAX_DEPTH_ALLOWED = 2; // 0 indexed

// Check if converting to a comparison condition will exceed the max depth
// including any nested conditions
export const doesConvertingToComparisonRespectMaxDepth = (
  depth: number,
  condition: ResourceCondition,
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

export const isEmptyCondition = (condition: ResourceCondition): boolean =>
  isComparisonCondition(condition) && condition.conditions.length === 0;

export const isMetadataCondition = (
  condition: ResourceCondition,
): condition is MetadataCondition =>
  condition.type === ResourceFilterType.Metadata;

export const isKindCondition = (
  condition: ResourceCondition,
): condition is KindCondition => condition.type === ResourceFilterType.Kind;

export const isNameCondition = (
  condition: ResourceCondition,
): condition is NameCondition => condition.type === ResourceFilterType.Name;

export const isProviderCondition = (
  condition: ResourceCondition,
): condition is ProviderCondition =>
  condition.type === ResourceFilterType.Provider;

export const isIdentifierCondition = (
  condition: ResourceCondition,
): condition is IdentifierCondition =>
  condition.type === ResourceFilterType.Identifier;

export const isCreatedAtCondition = (
  condition: ResourceCondition,
): condition is CreatedAtCondition => condition.type === FilterType.CreatedAt;

export const isValidResourceCondition = (
  condition: ResourceCondition,
): boolean => {
  if (isComparisonCondition(condition))
    return condition.conditions.every((c) => isValidResourceCondition(c));
  if (isMetadataCondition(condition)) {
    if (condition.operator === ResourceOperator.Null)
      return condition.value == null && condition.key.length > 0;
    return condition.key.length > 0;
  }
  return condition.value.length > 0;
};
