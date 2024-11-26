import { z } from "zod";

import { columnOperator } from "../../conditions/index.js";

export const nameCondition = z.object({
  type: z.literal("name"),
  operator: columnOperator,
  value: z.string().min(1),
});

export type NameCondition = z.infer<typeof nameCondition>;
