import { z } from "zod";

import { columnOperator } from "./index.js";

export const nameCondition = z.object({
  type: z.literal("name"),
  operator: columnOperator,
  value: z.string(),
});

export type NameCondition = z.infer<typeof nameCondition>;
