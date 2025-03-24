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
 * Function to get count of recent deployments for a release
 */
export type GetRecentDeploymentCountFunction = (
  releaseId: string,
  timeWindowMs: number,
) => Promise<number> | number;

/**
 * Options for configuring the GradualRolloutRule
 */
export type GradualVersionRolloutRuleOptions = {
  /**
   * Maximum number of deployments allowed within the time window
   */
  maxDeploymentsPerTimeWindow: number;

  /**
   * Size of the time window in minutes
   */
  timeWindowMinutes: number;

  /**
   * Function to get count of recent deployments
   */
  getRecentDeploymentCount?: GetRecentDeploymentCountFunction;
};

const getRecentDeploymentCount: GetRecentDeploymentCountFunction = async (
  releaseId: string,
  _: number,
) => {
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
export class GradualVersionRolloutRule implements DeploymentResourceRule {
  public readonly name = "GradualVersionRolloutRule";
  private getRecentDeploymentCount: GetRecentDeploymentCountFunction;

  constructor(private options: GradualVersionRolloutRuleOptions) {
    this.getRecentDeploymentCount =
      options.getRecentDeploymentCount ?? getRecentDeploymentCount;
  }

  /**
   * Filters releases based on gradual rollout rules.
   *
   * This function tracks the number of successful deployments of a release within a time window
   * and prevents additional deployments if the limit is reached.
   *
   * The desired release ID is tracked per-call, so if it changes between calls, the counts
   * will be tracked separately. For example:
   */
  async filter(
    _: DeploymentResourceContext,
    currentCandidates: Release[],
  ): Promise<DeploymentResourceRuleResult> {
    const timeWindowMs = this.options.timeWindowMinutes * 60 * 1000;

    // Process all releases in parallel for efficiency
    const releaseChecks = await Promise.all(
      currentCandidates.map(async (release) => {
        const recentDeployments = await this.getRecentDeploymentCount(
          release.id,
          timeWindowMs,
        );

        return {
          release,
          recentDeployments,
          isAllowed:
            recentDeployments < this.options.maxDeploymentsPerTimeWindow,
        };
      }),
    );

    // Separate allowed and disallowed releases using filter
    const allowedReleases = releaseChecks
      .filter((check) => check.isAllowed)
      .map((check) => check.release);

    const disallowedReleases = releaseChecks
      .filter((check) => !check.isAllowed)
      .map((check) => ({
        release: check.release,
        count: check.recentDeployments,
      }));

    // Determine reason based on disallowed releases
    let reason: string | undefined;

    if (disallowedReleases.length > 0) {
      // Get comma-separated list of disallowed release IDs
      const disallowedIds = disallowedReleases
        .map((d) => d.release.version.tag)
        .join(", ");

      reason = `Gradual rollout limit reached for releases: ${disallowedIds} (exceeded ${this.options.maxDeploymentsPerTimeWindow} deployments in the last ${this.options.timeWindowMinutes} minutes).`;

      // If all were disallowed, provide a more detailed reason
      if (allowedReleases.length === 0) {
        // Find the candidate with lowest excess deployments (closest to being allowed)
        const bestCandidate =
          disallowedReleases.length > 0
            ? disallowedReleases.reduce(
                (best, current) =>
                  best && current.count < best.count
                    ? current
                    : (best ?? current),
                disallowedReleases[0],
              )
            : null;

        reason = bestCandidate
          ? `Gradual rollout limit reached for all release candidates. Best candidate (${bestCandidate.release.id}) has ${bestCandidate.count}/${this.options.maxDeploymentsPerTimeWindow} deployments in the last ${this.options.timeWindowMinutes} minutes.`
          : `Gradual rollout limit reached for all release candidates.`;
      }
    }

    return { allowedReleases, reason };
  }
}
