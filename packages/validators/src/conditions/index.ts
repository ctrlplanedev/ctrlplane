export * from "./metadata-condition.js";
export * from "./date-condition.js";
export * from "./version-condition.js";

export enum ColumnOperator {
  Equals = "equals",
  Like = "like",
  Regex = "regex",
  Null = "null",
}

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
