import { z } from "zod";

export const environmentCondition = z.object({
  type: z.literal("environment"),
  operator: z.literal("equals"),
  value: z.string().uuid(),
});

export type EnvironmentCondition = z.infer<typeof environmentCondition>;
