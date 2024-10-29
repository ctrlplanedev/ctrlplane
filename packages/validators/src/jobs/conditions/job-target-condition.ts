import { z } from "zod";

export const jobTargetCondition = z.object({
  type: z.literal("target"),
  operator: z.literal("equals"),
  value: z.string().uuid(),
});

export type JobTargetCondition = z.infer<typeof jobTargetCondition>;
