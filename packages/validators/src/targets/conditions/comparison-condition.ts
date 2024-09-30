import { z } from "zod";

import type { KindCondition } from "./kind-condition.js";
import type { MetadataCondition } from "./metadata-condition.js";
import type { NameCondition } from "./name-condition.js";
import type { ProviderCondition } from "./provider-condition.js";
import { kindCondition } from "./kind-condition.js";
import { metadataCondition } from "./metadata-condition.js";
import { nameCondition } from "./name-condition.js";
import { providerCondition } from "./provider-condition.js";

export const comparisonCondition: z.ZodType<ComparisonCondition> = z.lazy(() =>
  z.object({
    type: z.literal("comparison"),
    operator: z.literal("or").or(z.literal("and")),
    not: z.boolean().optional().default(false),
    conditions: z.array(
      z.union([
        metadataCondition,
        comparisonCondition,
        kindCondition,
        nameCondition,
        providerCondition,
      ]),
    ),
  }),
);

export type ComparisonCondition = {
  type: "comparison";
  operator: "and" | "or";
  not?: boolean;
  conditions: Array<
    | ComparisonCondition
    | MetadataCondition
    | KindCondition
    | NameCondition
    | ProviderCondition
  >;
};
