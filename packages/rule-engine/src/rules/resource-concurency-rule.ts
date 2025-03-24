import { and, count, eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
} from "../types.js";
import { Releases } from "../utils/releases.js";

type ResourceConcurrencyRuleOptions = {
  /**
   * The maximum number of concurrent jobs allowed for the resource.
   */
  concurrencyLimit: number;

  getRunningCount: (resourceId: string) => Promise<number>;
};

const getRunningCount = async (resourceId: string): Promise<number> => {
  return db
    .select({ count: count() })
    .from(schema.job)
    .innerJoin(
      schema.releaseJobTrigger,
      eq(schema.job.id, schema.releaseJobTrigger.jobId),
    )
    .where(
      and(
        eq(schema.releaseJobTrigger.id, resourceId),
        inArray(schema.job.status, [JobStatus.InProgress, JobStatus.Pending]),
      ),
    )
    .then((r) => r[0]?.count ?? 0);
};

/**
 * A rule that limits the number of concurrent jobs running on a resource.
 *
 * This rule checks the number of currently running jobs for a resource and
 * prevents new jobs from being created if the concurrency limit has been
 * reached.
 *
 * @example
 * ```ts
 * // Allow up to 3 concurrent jobs running on a resource
 * new ResourceConcurrencyRule({ concurrencyLimit: 3 });
 * ```
 */
export class ResourceConcurrencyRule implements DeploymentResourceRule {
  public readonly name = "ResourceConcurrencyRule";

  constructor(
    private options: ResourceConcurrencyRuleOptions = {
      concurrencyLimit: 1,
      getRunningCount,
    },
  ) {}

  async filter(
    ctx: DeploymentResourceContext,
    releases: Releases,
  ): Promise<DeploymentResourceRuleResult> {
    const { concurrencyLimit, getRunningCount } = this.options;
    const runningDeployments = await getRunningCount(ctx.deployment.id);

    if (runningDeployments >= concurrencyLimit)
      return {
        allowedReleases: Releases.empty(),
        reason: `Concurrency limit reached (${runningDeployments} of ${concurrencyLimit}). No new deployments allowed.`,
      };

    return { allowedReleases: releases };
  }
}
