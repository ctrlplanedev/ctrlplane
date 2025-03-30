import { z } from "zod";

import type { IdCondition } from "./id-condition.js";
import type { NameCondition } from "./name-condition.js";
import type { SlugCondition } from "./slug-condition.js";
import type { SystemCondition } from "./system-condition.js";
import { idCondition } from "./id-condition.js";
import { nameCondition } from "./name-condition.js";
import { slugCondition } from "./slug-condition.js";
import { systemCondition } from "./system-condition.js";

export const comparisonCondition: z.ZodType<ComparisonCondition> = z.lazy(() =>
  z.object({
    type: z.literal("comparison"),
    operator: z.literal("and").or(z.literal("or")),
    not: z.boolean().optional().default(false),
    conditions: z.array(
      z.union([nameCondition, slugCondition, systemCondition, idCondition]),
    ),
  }),
);

export type ComparisonCondition = {
  type: "comparison";
  operator: "and" | "or";
  not?: boolean;
  conditions: Array<
    NameCondition | SlugCondition | SystemCondition | IdCondition
  >;
};
