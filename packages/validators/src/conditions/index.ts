import { z } from "zod";

import { columnOperator } from "./column-operator.js";

export * from "./metadata-condition.js";
export * from "./date-condition.js";
export * from "./id-condition.js";
export * from "./system-condition.js";
export * from "./name-condition.js";
export * from "./column-operator.js";

export enum ComparisonOperator {
  And = "and",
  Or = "or",
}

export enum ConditionType {
  Metadata = "metadata",
  CreatedAt = "created-at",
  Comparison = "comparison",
  Version = "version",
}

export const MAX_DEPTH_ALLOWED = 2; // 0 indexed

// importing issue - if this is in another file, since it references
// columnOperator it throws an error saying that columnOperator is not initialized yet
// so we need to keep it here
export const versionCondition = z.object({
  type: z.literal("version"),
  operator: columnOperator,
  value: z.string().min(1),
});

export type VersionCondition = z.infer<typeof versionCondition>;
