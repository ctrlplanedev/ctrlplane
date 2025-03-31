import { z } from "zod";

import type { IdCondition } from "../conditions/index.js";
import type { MetadataCondition } from "../conditions/metadata-condition.js";
import type { NameCondition } from "../conditions/name-condition.js";
import type { SystemCondition } from "../conditions/system-condition.js";
import type { ComparisonCondition } from "./comparison-condition.js";
import type { DirectoryCondition } from "./directory-condition.js";
import { idCondition } from "../conditions/index.js";
import { metadataCondition } from "../conditions/metadata-condition.js";
import { nameCondition } from "../conditions/name-condition.js";
import { systemCondition } from "../conditions/system-condition.js";
import { comparisonCondition } from "./comparison-condition.js";
import { directoryCondition } from "./directory-condition.js";

export type EnvironmentCondition =
  | ComparisonCondition
  | NameCondition
  | SystemCondition
  | DirectoryCondition
  | IdCondition
  | MetadataCondition;

export const environmentCondition: z.ZodType<EnvironmentCondition> = z.lazy(
  () =>
    z.union([
      comparisonCondition,
      nameCondition,
      systemCondition,
      directoryCondition,
      idCondition,
      metadataCondition,
    ]),
);
