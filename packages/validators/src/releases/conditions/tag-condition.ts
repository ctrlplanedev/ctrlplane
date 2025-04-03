import { z } from "zod";

import { columnOperator } from "../../conditions/index.js";

export const tagCondition = z.object({
  type: z.literal("tag"),
  operator: columnOperator,
  value: z.string().min(1),
});

export type TagCondition = z.infer<typeof tagCondition>;
