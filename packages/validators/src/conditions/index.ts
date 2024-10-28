import { z } from "zod";

export * from "./metadata-condition.js";
export * from "./date-condition.js";

export enum ColumnOperator {
  Equals = "equals",
  Like = "like",
  Regex = "regex",
}

export const columnOperator = z
  .literal(ColumnOperator.Equals)
  .or(z.literal(ColumnOperator.Like))
  .or(z.literal(ColumnOperator.Regex));

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

export const versionCondition = z.object({
  type: z.literal("version"),
  operator: columnOperator,
  value: z.string().min(1),
});

export type VersionCondition = z.infer<typeof versionCondition>;
