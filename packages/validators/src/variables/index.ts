import { z } from "zod";

import { resourceCondition } from "../resources/index.js";

export const ChoiceVariableConfig = z.object({
  type: z.literal("choice"),
  options: z.array(z.string()),
  default: z.string().optional(),
});
export type ChoiceVariableConfigType = z.infer<typeof ChoiceVariableConfig>;

export const StringVariableConfig = z.object({
  type: z.literal("string"),
  inputType: z.enum(["text-area", "text"]),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  default: z.string().optional(),
});
export type StringVariableConfigType = z.infer<typeof StringVariableConfig>;

export const NumberVariableConfig = z.object({
  type: z.literal("number"),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  default: z.number().optional(),
});
export type NumberVariableConfigType = z.infer<typeof NumberVariableConfig>;

export const BooleanVariableConfig = z.object({
  type: z.literal("boolean"),
  default: z.boolean().optional(),
});
export type BooleanVariableConfigType = z.infer<typeof BooleanVariableConfig>;

export const ResourceVariableConfig = z.object({
  type: z.literal("resource"),
  filter: resourceCondition.optional(),
});
export type ResourceVariableConfigType = z.infer<typeof ResourceVariableConfig>;

export const EnvironmentVariableConfig = z.object({
  type: z.literal("environment"),
});
export type EnvironmentVariableConfigType = z.infer<
  typeof EnvironmentVariableConfig
>;

export const DeploymentVariableConfig = z.object({
  type: z.literal("deployment"),
});
export type DeploymentVariableConfigType = z.infer<
  typeof DeploymentVariableConfig
>;

export const VariableConfig = z.union([
  StringVariableConfig,
  NumberVariableConfig,
  BooleanVariableConfig,
  ChoiceVariableConfig,
]);
export type VariableConfigType = z.infer<typeof VariableConfig>;

export const RunbookVariableConfig = z.union([
  VariableConfig,
  ResourceVariableConfig,
  EnvironmentVariableConfig,
  DeploymentVariableConfig,
]);
export type RunbookVariableConfigType = z.infer<typeof RunbookVariableConfig>;

export function validateJSONSchema(
  schema: unknown,
): schema is VariableConfigType {
  return VariableConfig.safeParse(schema).success;
}
