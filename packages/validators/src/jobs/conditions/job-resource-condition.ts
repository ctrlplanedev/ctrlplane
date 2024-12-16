import { z } from "zod";

export const jobResourceCondition = z.object({
  type: z.literal("resource"),
  operator: z.literal("equals"),
  value: z.string().uuid(),
});

export type JobResourceCondition = z.infer<typeof jobResourceCondition>;
