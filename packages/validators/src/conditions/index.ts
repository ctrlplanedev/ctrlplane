import { z } from "zod";

export * from "./metadata-condition.js";
export * from "./date-condition.js";

export enum ColumnOperator {
  Equals = "equals",
  StartsWith = "starts-with",
  EndsWith = "ends-with",
  Contains = "contains",
}

export const columnOperator = z.nativeEnum(ColumnOperator);

export type ColumnOperatorType = z.infer<typeof columnOperator>;

export enum ComparisonOperator {
  And = "and",
  Or = "or",
}

export enum FilterType {
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
