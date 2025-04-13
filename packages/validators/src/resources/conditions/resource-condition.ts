import { z } from "zod";

import type {
  CreatedAtCondition,
  IdCondition,
  MetadataCondition,
} from "../../conditions/index.js";
import type { ComparisonCondition } from "./comparison-condition.js";
import type { IdentifierCondition } from "./identifier-condition.js";
import type { KindCondition } from "./kind-condition.js";
import type { LastSyncCondition } from "./last-sync-condition.js";
import type { NameCondition } from "./name-condition.js";
import type { ProviderCondition } from "./provider-condition.js";
import type { VersionCondition } from "./version-condition.js";
import {
  ConditionType,
  createdAtCondition,
  idCondition,
  metadataCondition,
} from "../../conditions/index.js";
import { comparisonCondition } from "./comparison-condition.js";
import { identifierCondition } from "./identifier-condition.js";
import { kindCondition } from "./kind-condition.js";
import { lastSyncCondition } from "./last-sync-condition.js";
import { nameCondition } from "./name-condition.js";
import { providerCondition } from "./provider-condition.js";
import { versionCondition } from "./version-condition.js";

export type ResourceCondition =
  | ComparisonCondition
  | MetadataCondition
  | KindCondition
  | NameCondition
  | ProviderCondition
  | IdentifierCondition
  | CreatedAtCondition
  | LastSyncCondition
  | VersionCondition
  | IdCondition;

export const resourceCondition = z.union([
  comparisonCondition,
  metadataCondition,
  kindCondition,
  nameCondition,
  providerCondition,
  identifierCondition,
  createdAtCondition,
  lastSyncCondition,
  versionCondition,
  idCondition,
]);

export enum ResourceOperator {
  Equals = "equals",
  Like = "like",
  Null = "null",
  And = "and",
  Or = "or",
}

export enum ResourceConditionType {
  Metadata = "metadata",
  Kind = "kind",
  Name = "name",
  Identifier = "identifier",
  Provider = "provider",
  Comparison = "comparison",
  LastSync = "last-sync",
  Version = "version",
  Id = "id",
}

export const defaultCondition: ResourceCondition = {
  type: ResourceConditionType.Comparison,
  operator: ResourceOperator.And,
  not: false,
  conditions: [],
};

export const isComparisonCondition = (
  condition: ResourceCondition,
): condition is ComparisonCondition =>
  condition.type === ResourceConditionType.Comparison;

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
  condition.type === ResourceConditionType.Metadata;

export const isKindCondition = (
  condition: ResourceCondition,
): condition is KindCondition => condition.type === ResourceConditionType.Kind;

export const isNameCondition = (
  condition: ResourceCondition,
): condition is NameCondition => condition.type === ResourceConditionType.Name;

export const isProviderCondition = (
  condition: ResourceCondition,
): condition is ProviderCondition =>
  condition.type === ResourceConditionType.Provider;

export const isIdentifierCondition = (
  condition: ResourceCondition,
): condition is IdentifierCondition =>
  condition.type === ResourceConditionType.Identifier;

export const isCreatedAtCondition = (
  condition: ResourceCondition,
): condition is CreatedAtCondition =>
  condition.type === ConditionType.CreatedAt;

export const isLastSyncCondition = (
  condition: ResourceCondition,
): condition is LastSyncCondition =>
  condition.type === ResourceConditionType.LastSync;

export const isVersionCondition = (
  condition: ResourceCondition,
): condition is VersionCondition =>
  condition.type === ResourceConditionType.Version;

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
  if (isLastSyncCondition(condition) || isCreatedAtCondition(condition)) {
    try {
      new Date(condition.value);
      return true;
    } catch {
      return false;
    }
  }
  return condition.value.length > 0;
};
