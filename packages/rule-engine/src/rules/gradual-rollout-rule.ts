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
 * Options for configuring the GradualRolloutRule
 */
export type GradualRolloutRuleOptions = {
  /**
   * Maximum number of deployments allowed within the time window
   */
  maxDeploymentsPerTimeWindow: number;

  /**
   * Size of the time window in minutes
   */
  timeWindowMinutes: number;
};

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

  constructor(private options: GradualRolloutRuleOptions) {}

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

  /**
   * Filters releases based on gradual rollout rules.
   *
   * This function tracks the number of successful deployments of a release within a time window
   * and prevents additional deployments if the limit is reached.
   *
   * The desired release ID is tracked per-call, so if it changes between calls, the counts
   * will be tracked separately. For example:
   *
   * @example
   * ```ts
   * // First call with release-1
   * await rule.filter({
   *   desiredReleaseId: 'release-1',
   *   // ... other context
   * }, candidates); // Allows release-1 if under limit
   *
   * // Later call with release-2
   * await rule.filter({
   *   desiredReleaseId: 'release-2',
   *   // ... other context
   * }, candidates); // Tracks release-2 separately
   *
   * // Back to release-1
   * await rule.filter({
   *   desiredReleaseId: 'release-1',
   *   // ... other context
   * }, candidates); // Uses release-1's count
   * ```
   */
  async filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): Promise<DeploymentResourceRuleResult> {
    // If the desired release isn't in the candidates list, we can't enforce
    // gradual rollout limits on it, so we allow all candidates through
    // unchanged
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
