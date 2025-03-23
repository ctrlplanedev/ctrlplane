import { and, count, eq } from "@ctrlplane/db";
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
 * A rule that implements gradual rollout of new versions.
 *
 * This rule controls the pace of deployment for new versions, ensuring
 * that changes are rolled out gradually across resources to limit risk.
 *
 * @example
 * ```ts
 * // Limit rollout to max 5 resources every 30 minutes
 * new GradualRolloutRule({
 *   maxDeploymentsPerTimeWindow: 5,
 *   timeWindowMinutes: 30
 * });
 * ```
 */
export class GradualRolloutRule implements DeploymentResourceRule {
  public readonly name = "GradualRolloutRule";

  constructor(
    private options: {
      maxDeploymentsPerTimeWindow: number;
      timeWindowMinutes: number;
    },
  ) {}

  private async getRecentDeploymentCount(releaseId: string): Promise<number> {
    const timeWindowMs = this.options.timeWindowMinutes * 60 * 1000;
    const cutoffTime = new Date(Date.now() - timeWindowMs);

    return db
      .select({ count: count() })
      .from(schema.job)
      .innerJoin(
        schema.releaseJobTrigger,
        eq(schema.job.id, schema.releaseJobTrigger.jobId),
      )
      .where(
        and(
          eq(schema.releaseJobTrigger.versionId, releaseId),
          eq(schema.job.status, JobStatus.Successful),
        ),
      )
      .then((r) => r[0]?.count ?? 0);
  }

  async filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): Promise<DeploymentResourceRuleResult> {
    // If we don't have the desired release, nothing to do
    const desiredRelease = currentCandidates.find(
      (r) => r.id === ctx.desiredReleaseId,
    );
    if (!desiredRelease) {
      return { allowedReleases: currentCandidates };
    }

    // Get count of recent deployments for this release
    const recentDeployments = await this.getRecentDeploymentCount(
      ctx.desiredReleaseId,
    );

    // Check if we've hit the limit for this time window
    if (recentDeployments >= this.options.maxDeploymentsPerTimeWindow) {
      // Filter out the desired release
      const filteredReleases = currentCandidates.filter(
        (r) => r.id !== ctx.desiredReleaseId,
      );

      return {
        allowedReleases: filteredReleases,
        reason: `Gradual rollout limit reached (${recentDeployments}/${this.options.maxDeploymentsPerTimeWindow} deployments in the last ${this.options.timeWindowMinutes} minutes). Please try again later.`,
      };
    }

    return { allowedReleases: currentCandidates };
  }
}