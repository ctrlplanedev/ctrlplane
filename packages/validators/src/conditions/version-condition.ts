import { z } from "zod";

export const versionCondition = z.object({
  type: z.literal("version"),
  operator: z.literal("like").or(z.literal("regex")).or(z.literal("equals")),
  value: z.string().min(1),
});

export type VersionCondition = z.infer<typeof versionCondition>;

export enum VersionOperator {
  Like = "like",
  Regex = "regex",
  Equals = "equals",
}

export type VersionOperatorType = z.infer<typeof versionCondition>["operator"];
