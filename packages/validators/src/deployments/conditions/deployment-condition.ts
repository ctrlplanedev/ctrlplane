import { z } from "zod";

import type { IdCondition } from "../../conditions/index.js";
import type { NameCondition } from "../../conditions/name-condition.js";
import type { SystemCondition } from "../../conditions/system-condition.js";
import type { ComparisonCondition } from "./comparison-condition.js";
import type { SlugCondition } from "./slug-condition.js";
import { idCondition } from "../../conditions/index.js";
import { nameCondition } from "../../conditions/name-condition.js";
import { systemCondition } from "../../conditions/system-condition.js";
import { comparisonCondition } from "./comparison-condition.js";
import { slugCondition } from "./slug-condition.js";

export type DeploymentCondition =
  | ComparisonCondition
  | NameCondition
  | SlugCondition
  | SystemCondition
  | IdCondition;

export const deploymentCondition: z.ZodType<DeploymentCondition> = z.lazy(() =>
  z.union([
    comparisonCondition,
    nameCondition,
    slugCondition,
    systemCondition,
    idCondition,
  ]),
);

export enum DeploymentConditionType {
  Comparison = "comparison",
  Name = "name",
  Slug = "slug",
  System = "system",
  Id = "id",
}

export const isComparisonCondition = (
  condition: DeploymentCondition,
): condition is ComparisonCondition =>
  condition.type === DeploymentConditionType.Comparison;

export const MAX_DEPTH_ALLOWED = 2; // 0 indexed

// Check if converting to a comparison condition will exceed the max depth
// including any nested conditions
export const doesConvertingToComparisonRespectMaxDepth = (
  depth: number,
  condition: DeploymentCondition,
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

export const isEmptyCondition = (condition: DeploymentCondition): boolean =>
  isComparisonCondition(condition) && condition.conditions.length === 0;

export const isNameCondition = (
  condition: DeploymentCondition,
): condition is NameCondition =>
  condition.type === DeploymentConditionType.Name;

export const isSlugCondition = (
  condition: DeploymentCondition,
): condition is SlugCondition =>
  condition.type === DeploymentConditionType.Slug;

export const isSystemCondition = (
  condition: DeploymentCondition,
): condition is SystemCondition =>
  condition.type === DeploymentConditionType.System;

export const isIdCondition = (
  condition: DeploymentCondition,
): condition is IdCondition => condition.type === DeploymentConditionType.Id;

export const isValidDeploymentCondition = (
  condition: DeploymentCondition,
): boolean => {
  if (isComparisonCondition(condition))
    return condition.conditions.every((c) => isValidDeploymentCondition(c));

  if (isNameCondition(condition)) return condition.value.length > 0;

  if (isSlugCondition(condition)) return condition.value.length > 0;

  if (isSystemCondition(condition)) {
    const parseResult = z.string().uuid().safeParse(condition.value);
    return parseResult.success;
  }

  if (isIdCondition(condition)) {
    const parseResult = z.string().uuid().safeParse(condition.value);
    return parseResult.success;
  }

  return true;
};
