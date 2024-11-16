import { z } from "zod";

export const nameCondition = z.object({
  type: z.literal("name"),
  operator: z.literal("like"),
  value: z.string().min(1),
});

export type NameCondition = z.infer<typeof nameCondition>;
