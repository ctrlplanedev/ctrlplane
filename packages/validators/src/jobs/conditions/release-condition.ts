import { z } from "zod";

export const releaseCondition = z.object({
  type: z.literal("release"),
  operator: z.literal("equals"),
  value: z.string().uuid(),
});

export type ReleaseCondition = z.infer<typeof releaseCondition>;
