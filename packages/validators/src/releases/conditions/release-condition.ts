import { z } from "zod";

import type { CreatedAtCondition } from "../../conditions/date-condition.js";
import type {
  MetadataCondition,
  NameCondition,
  VersionCondition,
} from "../../conditions/index.js";
import type { ComparisonCondition } from "./comparison-condition.js";
import type { TagCondition } from "./tag-condition.js";
import { createdAtCondition } from "../../conditions/date-condition.js";
import {
  metadataCondition,
  nameCondition,
  versionCondition,
} from "../../conditions/index.js";
import { comparisonCondition } from "./comparison-condition.js";
import { tagCondition } from "./tag-condition.js";

export type DeploymentVersionCondition =
  | ComparisonCondition
  | MetadataCondition
  | VersionCondition
  | CreatedAtCondition
  | TagCondition
  | NameCondition;

export const deploymentVersionCondition = z.union([
  comparisonCondition,
  metadataCondition,
  versionCondition,
  createdAtCondition,
  tagCondition,
  nameCondition,
]);

export enum DeploymentVersionOperator {
  Equals = "equals",
  Like = "like",
  Null = "null",
  And = "and",
  Or = "or",
  Before = "before",
  After = "after",
  BeforeOrOn = "before-or-on",
  AfterOrOn = "after-or-on",
}

export enum DeploymentVersionConditionType {
  Metadata = "metadata",
  Version = "version",
  Tag = "tag",
  Comparison = "comparison",
  CreatedAt = "created-at",
  Name = "name",
}

export const defaultCondition: DeploymentVersionCondition = {
  type: DeploymentVersionConditionType.Comparison,
  operator: DeploymentVersionOperator.And,
  not: false,
  conditions: [],
};

export const isEmptyCondition = (
  condition: DeploymentVersionCondition,
): boolean =>
  condition.type === DeploymentVersionConditionType.Comparison &&
  condition.conditions.length === 0;

export const isComparisonCondition = (
  condition: DeploymentVersionCondition,
): condition is ComparisonCondition =>
  condition.type === DeploymentVersionConditionType.Comparison;

export const MAX_DEPTH_ALLOWED = 2; // 0 indexed

// Check if converting to a comparison condition will exceed the max depth
// including any nested conditions
export const doesConvertingToComparisonRespectMaxDepth = (
  depth: number,
  condition: DeploymentVersionCondition,
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
  condition: DeploymentVersionCondition,
): condition is MetadataCondition =>
  condition.type === DeploymentVersionConditionType.Metadata;

export const isVersionCondition = (
  condition: DeploymentVersionCondition,
): condition is VersionCondition =>
  condition.type === DeploymentVersionConditionType.Version;

export const isCreatedAtCondition = (
  condition: DeploymentVersionCondition,
): condition is CreatedAtCondition =>
  condition.type === DeploymentVersionConditionType.CreatedAt;

export const isTagCondition = (
  condition: DeploymentVersionCondition,
): condition is TagCondition =>
  condition.type === DeploymentVersionConditionType.Tag;

export const isValidDeploymentVersionCondition = (
  condition: DeploymentVersionCondition,
): boolean => {
  if (isComparisonCondition(condition))
    return (
      condition.conditions.length > 0 &&
      condition.conditions.every((c) => isValidDeploymentVersionCondition(c))
    );
  if (isVersionCondition(condition)) return condition.value.length > 0;
  if (isTagCondition(condition)) return condition.value.length > 0;
  if (isCreatedAtCondition(condition)) return true;
  if (isMetadataCondition(condition)) {
    if (condition.operator === DeploymentVersionOperator.Null)
      return condition.value == null && condition.key.length > 0;
    return condition.key.length > 0;
  }
  return false;
};
