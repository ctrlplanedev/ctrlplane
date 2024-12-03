import { z } from "zod";

import type {
  CreatedAtCondition,
  MetadataCondition,
  VersionCondition,
} from "../../conditions/index.js";
import type { ComparisonCondition } from "./comparison-condition.js";
import type { DeploymentCondition } from "./deployment-condition.js";
import type { EnvironmentCondition } from "./environment-condition.js";
import type { JobTargetCondition } from "./job-target-condition.js";
import type { ReleaseCondition } from "./release-condition.js";
import type { StatusCondition } from "./status-condition.js";
import {
  ComparisonOperator,
  createdAtCondition,
  FilterType,
  MAX_DEPTH_ALLOWED,
  metadataCondition,
  MetadataOperator,
  versionCondition,
} from "../../conditions/index.js";
import { comparisonCondition } from "./comparison-condition.js";
import { deploymentCondition } from "./deployment-condition.js";
import { environmentCondition } from "./environment-condition.js";
import { jobTargetCondition } from "./job-target-condition.js";
import { releaseCondition } from "./release-condition.js";
import { statusCondition } from "./status-condition.js";

export type JobCondition =
  | ComparisonCondition
  | MetadataCondition
  | CreatedAtCondition
  | StatusCondition
  | DeploymentCondition
  | EnvironmentCondition
  | VersionCondition
  | JobTargetCondition
  | ReleaseCondition;

export const jobCondition = z.union([
  comparisonCondition,
  metadataCondition,
  createdAtCondition,
  statusCondition,
  deploymentCondition,
  environmentCondition,
  versionCondition,
  jobTargetCondition,
  releaseCondition,
]);

export const defaultCondition: JobCondition = {
  type: FilterType.Comparison,
  operator: ComparisonOperator.And,
  not: false,
  conditions: [],
};

export enum JobFilterType {
  Status = "status",
  Deployment = "deployment",
  Environment = "environment",
  Release = "release",
  JobTarget = "target",
}

export const isEmptyCondition = (condition: JobCondition): boolean =>
  condition.type === FilterType.Comparison && condition.conditions.length === 0;

export const isComparisonCondition = (
  condition: JobCondition,
): condition is ComparisonCondition => condition.type === FilterType.Comparison;

export const isMetadataCondition = (
  condition: JobCondition,
): condition is MetadataCondition => condition.type === FilterType.Metadata;

export const isCreatedAtCondition = (
  condition: JobCondition,
): condition is CreatedAtCondition => condition.type === FilterType.CreatedAt;

export const isStatusCondition = (
  condition: JobCondition,
): condition is StatusCondition => condition.type === JobFilterType.Status;

export const isEnvironmentCondition = (
  condition: JobCondition,
): condition is EnvironmentCondition =>
  condition.type === JobFilterType.Environment;

export const isDeploymentCondition = (
  condition: JobCondition,
): condition is DeploymentCondition =>
  condition.type === JobFilterType.Deployment;

export const isVersionCondition = (
  condition: JobCondition,
): condition is VersionCondition => condition.type === FilterType.Version;

export const isJobTargetCondition = (
  condition: JobCondition,
): condition is JobTargetCondition =>
  condition.type === JobFilterType.JobTarget;

// Check if converting to a comparison condition will exceed the max depth
// including any nested conditions
export const doesConvertingToComparisonRespectMaxDepth = (
  depth: number,
  condition: JobCondition,
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

export const isValidJobCondition = (condition: JobCondition): boolean => {
  if (isComparisonCondition(condition))
    return condition.conditions.every((c) => isValidJobCondition(c));
  if (isMetadataCondition(condition)) {
    if (condition.operator === MetadataOperator.Null)
      return condition.value == null && condition.key.length > 0;
    return condition.key.length > 0;
  }
  return condition.value.length > 0;
};
