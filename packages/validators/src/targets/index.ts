import { z } from "zod";

export * from "./kubernetes-v1.js";

export const nullCondition = z.object({
  type: z.literal("metadata"),
  key: z.string().min(1),
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
