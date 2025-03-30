import { z } from "zod";

import type { IdCondition } from "../../conditions/index.js";
import type { NameCondition } from "../../conditions/name-condition.js";
import type { SystemCondition } from "../../conditions/system-condition.js";
import type { ComparisonCondition } from "./comparison-condition.js";
import type { SlugCondition } from "./slug-condition.js";
import { idCondition } from "../../conditions/index.js";
import { nameCondition } from "../../conditions/name-condition.js";
import { systemCondition } from "../../conditions/system-condition.js";
import { comparisonCondition } from "./comparison-condition.js";
import { slugCondition } from "./slug-condition.js";

export type DeploymentCondition =
  | ComparisonCondition
  | NameCondition
  | SlugCondition
  | SystemCondition
  | IdCondition;

export const deploymentCondition: z.ZodType<DeploymentCondition> = z.lazy(() =>
  z.union([
    comparisonCondition,
    nameCondition,
    slugCondition,
    systemCondition,
    idCondition,
  ]),
);
