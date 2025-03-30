import { z } from "zod";

export const systemCondition = z.object({
  type: z.literal("system"),
  operator: z.literal("equals"),
  value: z.string(),
});

export type SystemCondition = z.infer<typeof systemCondition>;
