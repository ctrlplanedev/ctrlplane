import { z } from "zod";

import type { CreatedAtCondition } from "../../conditions/date-condition.js";
import type {
  MetadataCondition,
  VersionCondition,
} from "../../conditions/index.js";
import type { TagCondition } from "./tag-condition.js";
import { createdAtCondition } from "../../conditions/date-condition.js";
import { metadataCondition, versionCondition } from "../../conditions/index.js";
import { tagCondition } from "./tag-condition.js";

export const comparisonCondition: z.ZodType<ComparisonCondition> = z.lazy(() =>
  z.object({
    type: z.literal("comparison"),
    operator: z.literal("or").or(z.literal("and")),
    not: z.boolean().optional().default(false),
    conditions: z.array(
      z.union([
        metadataCondition,
        comparisonCondition,
        versionCondition,
        createdAtCondition,
        tagCondition,
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
    | VersionCondition
    | CreatedAtCondition
    | TagCondition
  >;
};
