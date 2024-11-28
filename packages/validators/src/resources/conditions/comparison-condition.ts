import { z } from "zod";

import type {
  CreatedAtCondition,
  MetadataCondition,
} from "../../conditions/index.js";
import type { IdentifierCondition } from "./identifier-condition.js";
import type { KindCondition } from "./kind-condition.js";
import type { NameCondition } from "./name-condition.js";
import type { ProviderCondition } from "./provider-condition.js";
import {
  createdAtCondition,
  metadataCondition,
} from "../../conditions/index.js";
import { identifierCondition } from "./identifier-condition.js";
import { kindCondition } from "./kind-condition.js";
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
        identifierCondition,
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
    | KindCondition
    | NameCondition
    | ProviderCondition
    | IdentifierCondition
    | CreatedAtCondition
  >;
};
