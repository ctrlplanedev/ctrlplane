import { z } from "zod";

import type { CreatedAtCondition } from "./created-at-condition.js";
import type { MetadataCondition } from "./metadata-condition.js";
import type { VersionCondition } from "./version-condition.js";
import { createdAtCondition } from "./created-at-condition.js";
import { metadataCondition } from "./metadata-condition.js";
import { versionCondition } from "./version-condition.js";

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
  >;
};