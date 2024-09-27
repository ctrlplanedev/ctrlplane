import { z } from "zod";

import type { KindCondition } from "./kind-condition.js";
import type { MetadataCondition } from "./metadata-condition.js";
import type { NameCondition } from "./name-condition.js";
import { kindCondition } from "./kind-condition.js";
import { metadataCondition } from "./metadata-condition.js";
import { nameCondition } from "./name-condition.js";

export const comparisonCondition: z.ZodType<ComparisonCondition> = z.lazy(() =>
  z.object({
    type: z.literal("comparison"),
    operator: z.literal("or").or(z.literal("and")),
    conditions: z.array(
      z.union([
        metadataCondition,
        comparisonCondition,
        kindCondition,
        nameCondition,
      ]),
    ),
  }),
);

export type ComparisonCondition = {
  type: "comparison";
  operator: "and" | "or";
  conditions: Array<
    ComparisonCondition | MetadataCondition | KindCondition | NameCondition
  >;
};