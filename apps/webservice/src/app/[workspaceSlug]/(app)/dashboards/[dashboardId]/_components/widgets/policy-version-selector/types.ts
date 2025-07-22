import { z } from "zod";

export const policyVersionSelectorConfig = z.object({
  policyId: z.string().uuid(),
  name: z.string().optional(),
  ctaText: z.string().optional(),
});

export type PolicyVersionSelectorConfig = z.infer<
  typeof policyVersionSelectorConfig
>;

export const getIsValidConfig = (config: any) => {
  const parsedConfig = policyVersionSelectorConfig.safeParse(config);
  return parsedConfig.success;
};
