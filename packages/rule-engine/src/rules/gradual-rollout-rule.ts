import { and, count, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";
import crypto from "crypto";

import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

/**
 * Configuration for deterministic rollout behavior
 */
export type DeterministicRolloutConfig = {
  /**
   * Seed string used to generate deterministic hashes
   */
  seed: string;
  
  /**
   * Percentage of resources to roll out per day (e.g., 25 = 25% per day)
   */
  percentagePerDay: number;
};

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
  
  /**
   * Optional configuration for deterministic rollout behavior
   */
  deterministicRollout?: DeterministicRolloutConfig;
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
 * 
 * // Deterministic rollout with 25% of resources over 24 hours
 * new GradualRolloutRule({
 *   maxDeploymentsPerTimeWindow: 5,
 *   timeWindowMinutes: 30,
 *   deterministicRollout: {
 *     seed: "my-release-seed",
 *     percentagePerDay: 25
 *   }
 * });
 * ```
 */
export class GradualRolloutRule implements DeploymentResourceRule {
  public readonly name = "GradualRolloutRule";

  constructor(
    private options: GradualRolloutRuleOptions,
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

  private isResourceEligibleForDeterministicRollout(
    resourceId: string,
    releaseId: string,
    daysSinceRelease: number
  ): boolean {
    if (!this.options.deterministicRollout) return true;

    const { seed, percentagePerDay } = this.options.deterministicRollout;
    
    // Calculate max percentage based on days since release, capped at 100%
    const maxPercentage = Math.min(percentagePerDay * daysSinceRelease, 100);
    
    // Create a deterministic hash from the resource ID, release ID, and seed
    const hash = crypto
      .createHash("sha256")
      .update(`${resourceId}-${releaseId}-${seed}`)
      .digest("hex");
    
    // Convert first 4 bytes of hash to a number between 0-100
    const hashValue = parseInt(hash.substring(0, 8), 16) % 100;
    
    // Resource is eligible if its hash value falls within the allowed percentage
    return hashValue < maxPercentage;
  }

  private getDaysSinceRelease(release: Release): number {
    const releaseDate = release.createdAt;
    const now = new Date();
    const msDiff = now.getTime() - releaseDate.getTime();
    return Math.floor(msDiff / (1000 * 60 * 60 * 24));
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

    // Check deterministic rollout eligibility if configured
    if (this.options.deterministicRollout) {
      const daysSinceRelease = this.getDaysSinceRelease(desiredRelease);
      const isEligible = this.isResourceEligibleForDeterministicRollout(
        ctx.resource.id,
        ctx.desiredReleaseId,
        daysSinceRelease
      );

      if (!isEligible) {
        // Filter out the desired release
        const filteredReleases = currentCandidates.filter(
          (r) => r.id !== ctx.desiredReleaseId,
        );

        const { percentagePerDay } = this.options.deterministicRollout;
        const currentPercentage = Math.min(percentagePerDay * daysSinceRelease, 100);

        return {
          allowedReleases: filteredReleases,
          reason: `Resource not eligible for release yet. Currently at ${currentPercentage}% rollout (${daysSinceRelease} days since release).`,
        };
      }
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