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

export const startsWithCondition = z.object({
  type: z.literal("metadata"),
  key: z.string().min(1),
  value: z.string(),
  operator: z.literal("starts-with"),
});

export type StartsWithCondition = z.infer<typeof startsWithCondition>;

export const endsWithCondition = z.object({
  type: z.literal("metadata"),
  key: z.string().min(1),
  value: z.string(),
  operator: z.literal("ends-with"),
});

export type EndsWithCondition = z.infer<typeof endsWithCondition>;

export const containsCondition = z.object({
  type: z.literal("metadata"),
  key: z.string().min(1),
  value: z.string(),
  operator: z.literal("contains"),
});

export type ContainsCondition = z.infer<typeof containsCondition>;

export const metadataCondition = z.union([
  startsWithCondition,
  endsWithCondition,
  containsCondition,
  regexCondition,
  equalsCondition,
  nullCondition,
]);

export type MetadataCondition = z.infer<typeof metadataCondition>;

export enum MetadataOperator {
  Equals = "equals",
  Regex = "regex",
  Null = "null",
  StartsWith = "starts-with",
  EndsWith = "ends-with",
  Contains = "contains",
}

export type MetadataOperatorType =
  | MetadataOperator.Equals
  | MetadataOperator.Regex
  | MetadataOperator.Null
  | MetadataOperator.StartsWith
  | MetadataOperator.EndsWith
  | MetadataOperator.Contains;

export enum ReservedMetadataKey {
  ExternalId = "ctrlplane/external-id",
  Links = "ctrlplane/links",
  ParentResourceIdentifier = "ctrlplane/parent-resource-identifier",
  KubernetesVersion = "kubernetes/version",
  KubernetesFlavor = "kubernetes/flavor",
  Ephemeral = "ctrlplane/ephemeral",
}
