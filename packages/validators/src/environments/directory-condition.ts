import { z } from "zod";

import { columnOperator } from "../conditions/index.js";

export const directoryCondition = z.object({
  type: z.literal("directory"),
  operator: columnOperator,
  value: z.string(),
});

export type DirectoryCondition = z.infer<typeof directoryCondition>;
