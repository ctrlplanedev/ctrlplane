import { z } from "zod";

import type { IdCondition } from "../conditions/index.js";
import type { MetadataCondition } from "../conditions/metadata-condition.js";
import type { NameCondition } from "../conditions/name-condition.js";
import type { SystemCondition } from "../conditions/system-condition.js";
import type { DirectoryCondition } from "./directory-condition.js";
import { idCondition } from "../conditions/index.js";
import { metadataCondition } from "../conditions/metadata-condition.js";
import { nameCondition } from "../conditions/name-condition.js";
import { systemCondition } from "../conditions/system-condition.js";
import { directoryCondition } from "./directory-condition.js";

export const comparisonCondition: z.ZodType<ComparisonCondition> = z.lazy(() =>
  z.object({
    type: z.literal("comparison"),
    operator: z.literal("and").or(z.literal("or")),
    not: z.boolean().optional().default(false),
    conditions: z.array(
      z.union([
        nameCondition,
        directoryCondition,
        systemCondition,
        idCondition,
        metadataCondition,
      ]),
    ),
  }),
);

export type ComparisonCondition = {
  type: "comparison";
  operator: "and" | "or";
  not?: boolean;
  conditions: Array<
    | NameCondition
    | DirectoryCondition
    | SystemCondition
    | IdCondition
    | MetadataCondition
  >;
};
