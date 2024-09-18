import { z } from "zod";

export * from "./kubernetes-v1.js";

export const equalsCondition = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  operator: z.literal("equals").optional(),
});

export type EqualCondition = z.infer<typeof equalsCondition>;

export const regexCondition = z.object({
  label: z.string().min(1),
  pattern: z.string().min(1),
  operator: z.literal("regex"),
});

export type RegexCondition = z.infer<typeof regexCondition>;

export const likeCondition = z.object({
  label: z.string().min(1),
  pattern: z.string().min(1),
  operator: z.literal("like"),
});

export type LikeCondition = z.infer<typeof likeCondition>;

export const comparisonCondition = z.object({
  operator: z.literal("or").or(z.literal("and")),
  conditions: z.lazy<any>(() =>
    z.union([
      likeCondition,
      regexCondition,
      equalsCondition,
      comparisonCondition,
    ]),
  ),
});

export type ComparisonCondition = {
  operator: "and" | "or";
  conditions: Array<
    ComparisonCondition | LikeCondition | RegexCondition | EqualCondition
  >;
};

export const labelConditions = z.union([
  equalsCondition,
  regexCondition,
  likeCondition,
  comparisonCondition,
]);

export type LabelCondition =
  | ComparisonCondition
  | LikeCondition
  | RegexCondition
  | EqualCondition;
