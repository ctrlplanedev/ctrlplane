import { z } from "zod";

import { operator, value } from "../../conditions/date-condition.js";

export const lastSyncCondition = z.object({
  type: z.literal("last-sync"),
  operator,
  value,
});

export type LastSyncCondition = z.infer<typeof lastSyncCondition>;
