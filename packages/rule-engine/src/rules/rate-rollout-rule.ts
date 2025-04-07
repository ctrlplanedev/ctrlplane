import { differenceInSeconds } from "date-fns";

import type { Releases } from "../releases.js";
import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  ResolvedRelease,
} from "../types.js";

export interface RateRolloutRuleOptions {
  /**
   * Duration in seconds over which the rollout should occur
   */
  rolloutDurationSeconds: number;

  /**
   * Custom reason to return when a release is denied due to rate limits
   */
  denyReason?: string;
}

export class RateRolloutRule implements DeploymentResourceRule {
  public readonly name = "RateRolloutRule";
  private rolloutDurationSeconds: number;
  private denyReason: string;

  constructor({
    rolloutDurationSeconds,
    denyReason = "Release denied due to rate-based rollout restrictions",
  }: RateRolloutRuleOptions) {
    this.rolloutDurationSeconds = rolloutDurationSeconds;
    this.denyReason = denyReason;
  }

  // For testing: allow injecting a custom "now" timestamp
  protected getCurrentTime(): Date {
    return new Date();
  }

  filter(
    _: DeploymentResourceContext,
    releases: Releases,
  ): DeploymentResourceRuleResult {
    const now = this.getCurrentTime();

    const rejectionReasons = new Map<string, string>();
    const allowedReleases = releases.filter((release) => {
      // Calculate how much time has passed since the release was created
      const versionCreatedAt = this.getVersionCreatedAt(release);
      const versionAge = differenceInSeconds(now, versionCreatedAt);

      // Calculate what percentage of the rollout period has elapsed
      const rolloutPercentage = Math.min(
        (versionAge / this.rolloutDurationSeconds) * 100,
        100,
      );

      // Generate a deterministic value based on the release ID
      // Using a simple hash function to get a value between 0-100
      const releaseValue = this.getHashValue(release.version.id);
      // If the release's hash value is less than the rollout percentage,
      // it's allowed to be deployed
      if (releaseValue <= rolloutPercentage) {
        return true;
      }
      // Otherwise, it's rejected with a reason
      const remainingTimeSeconds = Math.max(
        0,
        this.rolloutDurationSeconds - versionAge,
      );
      const remainingTimeHours = Math.floor(remainingTimeSeconds / 3600);
      const remainingTimeMinutes = Math.floor(
        (remainingTimeSeconds % 3600) / 60,
      );

      const timeDisplay =
        remainingTimeHours > 0
          ? `~${remainingTimeHours}h ${remainingTimeMinutes}m`
          : `~${remainingTimeMinutes}m`;

      rejectionReasons.set(
        release.id,
        `${this.denyReason} (${Math.floor(rolloutPercentage)}% complete, eligible in ${timeDisplay})`,
      );
      return false;
    });

    return { allowedReleases, rejectionReasons };
  }

  /**
   * Get the creation date of a release, preferring version.createdAt if available
   */
  private getVersionCreatedAt(release: ResolvedRelease): Date {
    return release.version.createdAt;
  }

  /**
   * Generate a deterministic value between 0-100 based on the release ID
   * This ensures releases are consistently evaluated
   */
  private getHashValue(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    // Normalize to 0-100 range
    return Math.abs(hash % 101);
  }
}
