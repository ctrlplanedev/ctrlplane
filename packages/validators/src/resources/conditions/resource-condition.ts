import { z } from "zod";

import type {
  CreatedAtCondition,
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
  createdAtCondition,
  SelectorType,
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
  | VersionCondition;

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
]);

export enum ResourceOperator {
  Equals = "equals",
  Like = "like",
  Null = "null",
  And = "and",
  Or = "or",
}

export enum ResourceSelectorType {
  Metadata = "metadata",
  Kind = "kind",
  Name = "name",
  Identifier = "identifier",
  Provider = "provider",
  Comparison = "comparison",
  LastSync = "last-sync",
  Version = "version",
}

export const defaultCondition: ResourceCondition = {
  type: ResourceSelectorType.Comparison,
  operator: ResourceOperator.And,
  not: false,
  conditions: [],
};

export const isComparisonCondition = (
  condition: ResourceCondition,
): condition is ComparisonCondition =>
  condition.type === ResourceSelectorType.Comparison;

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
  condition.type === ResourceSelectorType.Metadata;

export const isKindCondition = (
  condition: ResourceCondition,
): condition is KindCondition => condition.type === ResourceSelectorType.Kind;

export const isNameCondition = (
  condition: ResourceCondition,
): condition is NameCondition => condition.type === ResourceSelectorType.Name;

export const isProviderCondition = (
  condition: ResourceCondition,
): condition is ProviderCondition =>
  condition.type === ResourceSelectorType.Provider;

export const isIdentifierCondition = (
  condition: ResourceCondition,
): condition is IdentifierCondition =>
  condition.type === ResourceSelectorType.Identifier;

export const isCreatedAtCondition = (
  condition: ResourceCondition,
): condition is CreatedAtCondition => condition.type === SelectorType.CreatedAt;

export const isLastSyncCondition = (
  condition: ResourceCondition,
): condition is LastSyncCondition =>
  condition.type === ResourceSelectorType.LastSync;

export const isVersionCondition = (
  condition: ResourceCondition,
): condition is VersionCondition =>
  condition.type === ResourceSelectorType.Version;

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
