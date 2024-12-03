import { z } from "zod";

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
  value: z.string(),
  operator: z.literal("equals").optional(),
});

export type EqualCondition = z.infer<typeof equalsCondition>;

export const regexCondition = z.object({
  type: z.literal("metadata"),
  key: z.string().min(1),
  value: z.string(),
  operator: z.literal("regex"),
});

export type RegexCondition = z.infer<typeof regexCondition>;

export const likeCondition = z.object({
  type: z.literal("metadata"),
  key: z.string().min(1),
  value: z.string(),
  operator: z.literal("like"),
});

export type LikeCondition = z.infer<typeof likeCondition>;

export const metadataCondition = z.union([
  likeCondition,
  regexCondition,
  equalsCondition,
  nullCondition,
]);

export type MetadataCondition = z.infer<typeof metadataCondition>;

export enum MetadataOperator {
  Equals = "equals",
  Like = "like",
  Regex = "regex",
  Null = "null",
}

export type MetadataOperatorType =
  | MetadataOperator.Equals
  | MetadataOperator.Like
  | MetadataOperator.Regex
  | MetadataOperator.Null;

export enum ReservedMetadataKey {
  ExternalId = "ctrlplane/external-id",
  Links = "ctrlplane/links",
  ParentResourceIdentifier = "ctrlplane/parent-resource-identifier",
  KubernetesVersion = "kubernetes/version",
  KubernetesFlavor = "kubernetes/flavor",
}
