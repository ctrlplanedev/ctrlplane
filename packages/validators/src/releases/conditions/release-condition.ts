import { z } from "zod";

import type { CreatedAtCondition } from "../../conditions/date-condition.js";
import type {
  MetadataCondition,
  VersionCondition,
} from "../../conditions/index.js";
import type { ComparisonCondition } from "./comparison-condition.js";
import { createdAtCondition } from "../../conditions/date-condition.js";
import { metadataCondition, versionCondition } from "../../conditions/index.js";
import { comparisonCondition } from "./comparison-condition.js";

export type ReleaseCondition =
  | ComparisonCondition
  | MetadataCondition
  | VersionCondition
  | CreatedAtCondition;

export const releaseCondition = z.union([
  comparisonCondition,
  metadataCondition,
  versionCondition,
  createdAtCondition,
]);

export enum ReleaseOperator {
  Equals = "equals",
  Like = "like",
  Regex = "regex",
  Null = "null",
  And = "and",
  Or = "or",
  Before = "before",
  After = "after",
  BeforeOrOn = "before-or-on",
  AfterOrOn = "after-or-on",
}

export enum ReleaseFilterType {
  Metadata = "metadata",
  Version = "version",
  Comparison = "comparison",
  CreatedAt = "created-at",
}

export const defaultCondition: ReleaseCondition = {
  type: ReleaseFilterType.Comparison,
  operator: ReleaseOperator.And,
  not: false,
  conditions: [],
};

export const isEmptyCondition = (condition: ReleaseCondition): boolean =>
  condition.type === ReleaseFilterType.Comparison &&
  condition.conditions.length === 0;

export const isComparisonCondition = (
  condition: ReleaseCondition,
): condition is ComparisonCondition =>
  condition.type === ReleaseFilterType.Comparison;

export const MAX_DEPTH_ALLOWED = 2; // 0 indexed

// Check if converting to a comparison condition will exceed the max depth
// including any nested conditions
export const doesConvertingToComparisonRespectMaxDepth = (
  depth: number,
  condition: ReleaseCondition,
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
  condition: ReleaseCondition,
): condition is MetadataCondition =>
  condition.type === ReleaseFilterType.Metadata;

export const isVersionCondition = (
  condition: ReleaseCondition,
): condition is VersionCondition =>
  condition.type === ReleaseFilterType.Version;

export const isCreatedAtCondition = (
  condition: ReleaseCondition,
): condition is CreatedAtCondition =>
  condition.type === ReleaseFilterType.CreatedAt;

export const isValidReleaseCondition = (
  condition: ReleaseCondition,
): boolean => {
  if (isComparisonCondition(condition))
    return condition.conditions.every((c) => isValidReleaseCondition(c));
  if (isVersionCondition(condition)) return condition.value.length > 0;
  if (isCreatedAtCondition(condition)) return true;
  if (isMetadataCondition(condition)) {
    if (condition.operator === ReleaseOperator.Null)
      return condition.value == null && condition.key.length > 0;
    return condition.key.length > 0;
  }
  return false;
};
