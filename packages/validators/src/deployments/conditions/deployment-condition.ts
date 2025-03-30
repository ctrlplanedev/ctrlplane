import { z } from "zod";

import type { ComparisonCondition } from "./comparison-condition.js";
import type { IdCondition } from "./id-condition.js";
import type { NameCondition } from "./name-condition.js";
import type { SlugCondition } from "./slug-condition.js";
import type { SystemCondition } from "./system-condition.js";
import { comparisonCondition } from "./comparison-condition.js";
import { idCondition } from "./id-condition.js";
import { nameCondition } from "./name-condition.js";
import { slugCondition } from "./slug-condition.js";
import { systemCondition } from "./system-condition.js";

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
