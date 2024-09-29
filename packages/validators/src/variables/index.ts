import { z } from "zod";

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

export const VariableConfig = z.union([
  StringVariableConfig,
  NumberVariableConfig,
  BooleanVariableConfig,
  ChoiceVariableConfig,
]);

export type VariableConfigType = z.infer<typeof VariableConfig>;

export function validateJSONSchema(
  schema: unknown,
): schema is VariableConfigType {
  return VariableConfig.safeParse(schema).success;
}
