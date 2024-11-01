import { z } from "zod";

import type {
  CreatedAtCondition,
  MetadataCondition,
  VersionCondition,
} from "../../conditions/index.js";
import type { DeploymentCondition } from "./deployment-condition.js";
import type { EnvironmentCondition } from "./environment-condition.js";
import type { JobTargetCondition } from "./job-target-condition.js";
import type { ReleaseCondition } from "./release-condition.js";
import type { StatusCondition } from "./status-condition.js";
import {
  createdAtCondition,
  metadataCondition,
  versionCondition,
} from "../../conditions/index.js";
import { deploymentCondition } from "./deployment-condition.js";
import { environmentCondition } from "./environment-condition.js";
import { jobTargetCondition } from "./job-target-condition.js";
import { releaseCondition } from "./release-condition.js";
import { statusCondition } from "./status-condition.js";

export const comparisonCondition: z.ZodType<ComparisonCondition> = z.lazy(() =>
  z.object({
    type: z.literal("comparison"),
    operator: z.literal("and").or(z.literal("or")),
    not: z.boolean().optional().default(false),
    conditions: z.array(
      z.union([
        metadataCondition,
        comparisonCondition,
        createdAtCondition,
        statusCondition,
        deploymentCondition,
        environmentCondition,
        versionCondition,
        jobTargetCondition,
        releaseCondition,
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
    | CreatedAtCondition
    | StatusCondition
    | DeploymentCondition
    | EnvironmentCondition
    | VersionCondition
    | JobTargetCondition
    | ReleaseCondition
  >;
};
