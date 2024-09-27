import { z } from "zod";

export const kindCondition = z.object({
  type: z.literal("kind"),
  operator: z.literal("equals"),
  value: z.string().min(1),
});

export type KindCondition = z.infer<typeof kindCondition>;
