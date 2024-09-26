import { z } from "zod";

export * from "./kubernetes-v1.js";

export const nullCondition = z.object({
  type: z.literal("metadata"),
  key: z.string().min(1),
  value: z.string().optional(),
  operator: z.literal("null"),
});

export type NullCondition = z.infer<typeof nullCondition>;

export const equalsCondition = z.object({
  type: z.literal("metadata"),
  key: z.string().min(1),
  value: z.string().min(1),
  operator: z.literal("equals").optional(),
});

export type EqualCondition = z.infer<typeof equalsCondition>;

export const regexCondition = z.object({
  type: z.literal("metadata"),
  key: z.string().min(1),
  value: z.string().min(1),
  operator: z.literal("regex"),
});

export type RegexCondition = z.infer<typeof regexCondition>;

export const likeCondition = z.object({
  type: z.literal("metadata"),
  key: z.string().min(1),
  value: z.string().min(1),
  operator: z.literal("like"),
});

export type LikeCondition = z.infer<typeof likeCondition>;

export const comparisonCondition: z.ZodType<ComparisonCondition> = z.lazy(() =>
  z.object({
    type: z.literal("comparison"),
    operator: z.literal("or").or(z.literal("and")),
    conditions: z.array(
      z.union([
        likeCondition,
        regexCondition,
        equalsCondition,
        comparisonCondition,
        nullCondition,
        kindEqualsCondition,
        nameCondition,
      ]),
    ),
  }),
);

export type ComparisonCondition = {
  type: "comparison";
  operator: "and" | "or";
  conditions: Array<
    | ComparisonCondition
    | LikeCondition
    | RegexCondition
    | EqualCondition
    | NullCondition
    | KindEqualsCondition
    | NameCondition
  >;
};

export const kindEqualsCondition = z.object({
  type: z.literal("kind"),
  operator: z.literal("equals"),
  value: z.string().min(1),
});

export type KindEqualsCondition = z.infer<typeof kindEqualsCondition>;

export const nameEqualsCondition = z.object({
  type: z.literal("name"),
  operator: z.literal("equals"),
  value: z.string().min(1),
});

export type NameEqualsCondition = z.infer<typeof nameEqualsCondition>;

export const nameLikeCondition = z.object({
  type: z.literal("name"),
  operator: z.literal("like"),
  value: z.string().min(1),
});

export type NameLikeCondition = z.infer<typeof nameLikeCondition>;

export const nameRegexCondition = z.object({
  type: z.literal("name"),
  operator: z.literal("regex"),
  value: z.string().min(1),
});

export type NameRegexCondition = z.infer<typeof nameRegexCondition>;

export const nameCondition = z.union([
  nameEqualsCondition,
  nameLikeCondition,
  nameRegexCondition,
]);

export type NameCondition = z.infer<typeof nameCondition>;

export type TargetCondition =
  | ComparisonCondition
  | LikeCondition
  | RegexCondition
  | EqualCondition
  | NullCondition
  | KindEqualsCondition
  | NameCondition;

export const targetCondition = z.union([
  comparisonCondition,
  equalsCondition,
  regexCondition,
  likeCondition,
  nullCondition,
  kindEqualsCondition,
  nameCondition,
]);

export const metadataCondition = z.union([
  likeCondition,
  regexCondition,
  equalsCondition,
  nullCondition,
]);

export type MetadataCondition = z.infer<typeof metadataCondition>;

export enum ReservedMetadataKey {
  ExternalId = "ctrlplane/external-id",
  Links = "ctrlplane/links",
  ParentTargetIdentifier = "ctrlplane/parent-target-identifier",
  KubernetesVersion = "kubernetes/version",
  KubernetesFlavor = "kubernetes/flavor",
}

export enum TargetOperator {
  Equals = "equals",
  Like = "like",
  Regex = "regex",
  Null = "null",
  And = "and",
  Or = "or",
}

export enum TargetFilterType {
  Metadata = "metadata",
  Kind = "kind",
  Name = "name",
  Comparison = "comparison",
}

export const defaultCondition: TargetCondition = {
  type: TargetFilterType.Comparison,
  operator: TargetOperator.And,
  conditions: [],
};

export const isDefaultCondition = (condition: TargetCondition): boolean => {
  return (
    condition.type === TargetFilterType.Comparison &&
    condition.operator === TargetOperator.And &&
    condition.conditions.length === 0
  );
};

export const isComparisonCondition = (
  condition: TargetCondition,
): condition is ComparisonCondition =>
  condition.type === TargetFilterType.Comparison;

export const MAX_DEPTH_ALLOWED = 2; // 0 indexed

// Check if converting to a comparison condition will exceed the max depth
// including any nested conditions
export const doesConvertingToComparisonRespectMaxDepth = (
  depth: number,
  condition: TargetCondition,
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
  condition: TargetCondition,
): condition is MetadataCondition =>
  condition.type === TargetFilterType.Metadata;

export const isKindCondition = (
  condition: TargetCondition,
): condition is KindEqualsCondition => condition.type === TargetFilterType.Kind;

export const isNameLikeCondition = (
  condition: TargetCondition,
): condition is NameLikeCondition =>
  condition.type === TargetFilterType.Name &&
  condition.operator === TargetOperator.Like;

export const isValidTargetCondition = (condition: TargetCondition): boolean => {
  // a default condition is valid - it means the user wants to clear the filter
  // so it gets set to undefined, which matches all targets
  if (isDefaultCondition(condition)) return true;
  if (isComparisonCondition(condition)) {
    if (condition.conditions.length === 0) return false;
    return condition.conditions.every((c) => isValidTargetCondition(c));
  }
  if (isKindCondition(condition)) return condition.value.length > 0;
  if (isNameLikeCondition(condition)) return condition.value.length > 0;
  if (isMetadataCondition(condition)) {
    if (condition.operator === TargetOperator.Null)
      return condition.value == null && condition.key.length > 0;
    return condition.value.length > 0 && condition.key.length > 0;
  }
  return false;
};
