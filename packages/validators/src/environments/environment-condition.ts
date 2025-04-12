import { z } from "zod";

import type { IdCondition } from "../conditions/index.js";
import type { MetadataCondition } from "../conditions/metadata-condition.js";
import type { NameCondition } from "../conditions/name-condition.js";
import type { SystemCondition } from "../conditions/system-condition.js";
import type { ComparisonCondition } from "./comparison-condition.js";
import type { DirectoryCondition } from "./directory-condition.js";
import { idCondition } from "../conditions/index.js";
import {
  metadataCondition,
  MetadataOperator,
} from "../conditions/metadata-condition.js";
import { nameCondition } from "../conditions/name-condition.js";
import { systemCondition } from "../conditions/system-condition.js";
import { comparisonCondition } from "./comparison-condition.js";
import { directoryCondition } from "./directory-condition.js";

export type EnvironmentCondition =
  | ComparisonCondition
  | NameCondition
  | SystemCondition
  | DirectoryCondition
  | IdCondition
  | MetadataCondition;

export const environmentCondition: z.ZodType<EnvironmentCondition> = z.lazy(
  () =>
    z.union([
      comparisonCondition,
      nameCondition,
      systemCondition,
      directoryCondition,
      idCondition,
      metadataCondition,
    ]),
);

export enum EnvironmentConditionType {
  Comparison = "comparison",
  Name = "name",
  System = "system",
  Directory = "directory",
  Id = "id",
  Metadata = "metadata",
}

export const isComparisonCondition = (
  condition: EnvironmentCondition,
): condition is ComparisonCondition =>
  condition.type === EnvironmentConditionType.Comparison;

export const MAX_DEPTH_ALLOWED = 2; // 0 indexed

// Check if converting to a comparison condition will exceed the max depth
// including any nested conditions
export const doesConvertingToComparisonRespectMaxDepth = (
  depth: number,
  condition: EnvironmentCondition,
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

export const isEmptyCondition = (condition: EnvironmentCondition): boolean =>
  isComparisonCondition(condition) && condition.conditions.length === 0;

export const isNameCondition = (
  condition: EnvironmentCondition,
): condition is NameCondition =>
  condition.type === EnvironmentConditionType.Name;

export const isSystemCondition = (
  condition: EnvironmentCondition,
): condition is SystemCondition =>
  condition.type === EnvironmentConditionType.System;

export const isDirectoryCondition = (
  condition: EnvironmentCondition,
): condition is DirectoryCondition =>
  condition.type === EnvironmentConditionType.Directory;

export const isIdCondition = (
  condition: EnvironmentCondition,
): condition is IdCondition => condition.type === EnvironmentConditionType.Id;

export const isMetadataCondition = (
  condition: EnvironmentCondition,
): condition is MetadataCondition =>
  condition.type === EnvironmentConditionType.Metadata;

export const isValidEnvironmentCondition = (
  condition: EnvironmentCondition,
): boolean => {
  if (isComparisonCondition(condition))
    return condition.conditions.every((c) => isValidEnvironmentCondition(c));

  if (isMetadataCondition(condition)) {
    if (condition.operator === MetadataOperator.Null)
      return condition.value == null && condition.key.length > 0;
    return condition.key.length > 0;
  }

  if (isNameCondition(condition)) return condition.value.length > 0;

  if (isSystemCondition(condition)) {
    const parseResult = z.string().uuid().safeParse(condition.value);
    return parseResult.success;
  }

  if (isDirectoryCondition(condition)) return condition.value.length > 0;

  if (isIdCondition(condition)) {
    const parseResult = z.string().uuid().safeParse(condition.value);
    return parseResult.success;
  }

  return true;
};
