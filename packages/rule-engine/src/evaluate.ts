import { and, desc, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { DeploymentResourceContext } from "./types.js";
import type { Releases } from "./utils/releases.js";
import { RuleEngine } from "./rule-engine.js";
import { VersionCooldownRule } from "./rules/version-cooldown-rule.js";

const versionCooldownRule = (policy: schema.EnvironmentPolicy) =>
  new VersionCooldownRule({
    cooldownMinutes: policy.minimumReleaseInterval,
    getLastSuccessfulDeploymentTime: async (resourceId, versionId) => {
      const result = await db
        .select({ createdAt: schema.job.createdAt })
        .from(schema.job)
        .innerJoin(
          schema.releaseJobTrigger,
          eq(schema.job.id, schema.releaseJobTrigger.jobId),
        )
        .where(
          and(
            eq(schema.releaseJobTrigger.versionId, versionId),
            eq(schema.releaseJobTrigger.resourceId, resourceId),
            eq(schema.job.status, JobStatus.Successful),
          ),
        )
        .orderBy(desc(schema.job.createdAt))
        .limit(1);
      return result[0]?.createdAt ?? null;
    },
  });

export const evaluate = async (
  policy: SCHEMA.EnvironmentPolicy,
  releases: Releases,
  context: DeploymentResourceContext,
) => {
  const ruleEngine = new RuleEngine([versionCooldownRule(policy)]);
  const result = await ruleEngine.evaluate(releases, context);
};
