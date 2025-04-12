import { z } from "zod";

import { columnOperator } from "../../conditions/index.js";

export const slugCondition = z.object({
  type: z.literal("slug"),
  operator: columnOperator,
  value: z.string(),
});

export type SlugCondition = z.infer<typeof slugCondition>;
