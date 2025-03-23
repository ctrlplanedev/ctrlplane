import { and, count, eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

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
 * new ResourceConcurrencyRule(3);
 * ```
 */
export class ResourceConcurrencyRule implements DeploymentResourceRule {
  public readonly name = "ResourceConcurrencyRule";

  constructor(private concurrencyLimit: number) {}

  private async getRunningCount(resourceId: string): Promise<number> {
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
  }

  async filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): Promise<DeploymentResourceRuleResult> {
    const runningDeployments = await this.getRunningCount(ctx.deployment.id);

    if (runningDeployments >= this.concurrencyLimit)
      return {
        allowedReleases: [],
        reason: `Concurrency limit reached (${runningDeployments} of ${this.concurrencyLimit}). No new deployments allowed.`,
      };

    return { allowedReleases: currentCandidates };
  }
}
