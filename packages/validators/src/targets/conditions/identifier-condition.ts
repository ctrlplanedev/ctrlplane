import { z } from "zod";

import { columnOperator } from "../../conditions/index.js";

export const identifierCondition = z.object({
  type: z.literal("identifier"),
  operator: columnOperator,
  value: z.string().min(1),
});

export type IdentifierCondition = z.infer<typeof identifierCondition>;

export type IdentifierOperator = IdentifierCondition["operator"];
