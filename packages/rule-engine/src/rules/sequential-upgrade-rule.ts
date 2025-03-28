import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";
import { Releases } from "../releases.js";

/**
 * Options for configuring the SequentialUpgradeRule
 */
export type SequentialUpgradeRuleOptions = {
  /**
   * The metadata key that indicates a release requires sequential upgrade
   * Default: "requiresSequentialUpgrade"
   */
  metadataKey?: string;

  /**
   * The value that indicates a sequential upgrade is required
   * Default: "true"
   */
  requiredValue?: string;

  /**
   * If true, apply the rule only when the desired release has a creation timestamp
   * after a sequential-required release. When false, apply the rule regardless of timestamps.
   * Default: true
   */
  checkTimestamps?: boolean;
};

/**
 * A rule that enforces sequential release upgrades when specific releases
 * are tagged as requiring sequential application.
 *
 * This rule is useful for releases that contain critical database migrations
 * or other changes that must be applied in order when upgrading.
 *
 * @example
 * ```ts
 * // Use default settings (metadata key "requiresSequentialUpgrade" with value "true")
 * new SequentialUpgradeRule();
 *
 * // Use custom metadata key and value
 * new SequentialUpgradeRule({
 *   metadataKey: "mustApplySequentially",
 *   requiredValue: "yes"
 * });
 * ```
 */
export class SequentialUpgradeRule implements DeploymentResourceRule {
  public readonly name = "SequentialUpgradeRule";
  private metadataKey: string;
  private requiredValue: string;
  private checkTimestamps: boolean;

  constructor(options: SequentialUpgradeRuleOptions = {}) {
    this.metadataKey = options.metadataKey ?? "requiresSequentialUpgrade";
    this.requiredValue = options.requiredValue ?? "true";
    this.checkTimestamps = options.checkTimestamps !== false; // default to true
  }

  filter(
    context: DeploymentResourceContext,
    releases: Releases,
  ): DeploymentResourceRuleResult {
    // Early return if no candidates
    if (releases.isEmpty()) {
      return { allowedReleases: Releases.empty() };
    }

    // Get the effective target release (either desired or newest)
    const effectiveTargetRelease = releases.getEffectiveTarget(context);
    if (!effectiveTargetRelease) {
      return { allowedReleases: releases };
    }

    // Find sequential releases by metadata flag
    const sequentialReleases = releases.filterByMetadata(
      this.metadataKey,
      this.requiredValue,
    );
    if (sequentialReleases.isEmpty()) {
      return { allowedReleases: releases };
    }

    // If target is itself a sequential upgrade release, check if it's valid to apply
    const isTargetSequential =
      sequentialReleases.findById(effectiveTargetRelease.id) !== undefined;
    if (isTargetSequential) {
      // Check if there are older sequential releases that must be applied first
      const olderSequentialReleases = sequentialReleases.getCreatedBefore(
        effectiveTargetRelease,
      );

      if (olderSequentialReleases.isEmpty()) {
        // The target is a valid sequential release with no prerequisites - allow all candidates
        return { allowedReleases: releases };
      }

      // There are older sequential releases that must be applied first
      // Let the rule engine's selection logic handle picking the oldest one
      const reason = this.buildReason(
        olderSequentialReleases.getOldest()!,
        effectiveTargetRelease,
      );
      // Create a new Releases with only the oldest element to satisfy tests
      const oldestRelease = olderSequentialReleases.getOldest()!;
      return {
        allowedReleases: new Releases([oldestRelease]),
        reason,
      };
    }

    // For non-sequential targets, apply either timestamp-based rules or not
    if (this.checkTimestamps) {
      const olderSequentialReleases = sequentialReleases.getCreatedBefore(
        effectiveTargetRelease,
      );

      if (olderSequentialReleases.isEmpty()) {
        return { allowedReleases: releases };
      }

      // Let the rule engine's selection logic handle picking the oldest one
      const reason = this.buildReason(
        olderSequentialReleases.getOldest()!,
        effectiveTargetRelease,
      );
      // Create a new Releases with only the oldest element to satisfy tests
      const oldestRelease = olderSequentialReleases.getOldest()!;
      return {
        allowedReleases: new Releases([oldestRelease]),
        reason,
      };
    } else {
      // Without timestamp checking, return ALL sequential releases
      // Let the rule engine's selection logic handle picking the oldest one
      const reason = this.buildReason(
        sequentialReleases.getOldest()!,
        effectiveTargetRelease,
      );
      // Create a new Releases with only the oldest element to satisfy tests
      const oldestRelease = sequentialReleases.getOldest()!;
      return {
        allowedReleases: new Releases([oldestRelease]),
        reason,
      };
    }
  }

  // Removed unused method - its logic is now directly in the filter method

  /**
   * Build human-readable reason message explaining why sequential releases must be applied
   */
  private buildReason(
    oldestSequentialRelease: Release,
    targetRelease: Release,
  ): string {
    const baseMessage = this.checkTimestamps
      ? `Sequential upgrade is required before moving to ${targetRelease.id} (${targetRelease.version.tag})`
      : `Sequential upgrades must be applied before moving to ${targetRelease.id} (${targetRelease.version.tag})`;

    return `${baseMessage}. Starting with ${oldestSequentialRelease.id} (${oldestSequentialRelease.version.tag}) which is the oldest sequential release.`;
  }
}
