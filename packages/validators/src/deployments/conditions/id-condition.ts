import { z } from "zod";

export const idCondition = z.object({
  type: z.literal("id"),
  operator: z.literal("equals"),
  value: z.string(),
});

export type IdCondition = z.infer<typeof idCondition>;
