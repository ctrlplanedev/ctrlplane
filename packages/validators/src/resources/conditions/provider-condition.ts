import { z } from "zod";

export const providerCondition = z.object({
  type: z.literal("provider"),
  operator: z.literal("equals"),
  value: z.string().min(1),
});

export type ProviderCondition = z.infer<typeof providerCondition>;
