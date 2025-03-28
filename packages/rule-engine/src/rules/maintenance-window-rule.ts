import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
} from "../types.js";
import { Releases } from "../releases.js";

/**
 * Defines a maintenance window period during which deployments are blocked
 */
export type MaintenanceWindow = {
  /**
   * Descriptive name of the maintenance window
   */
  name: string;

  /**
   * Start date and time of the maintenance window
   */
  start: Date;

  /**
   * End date and time of the maintenance window
   */
  end: Date;
};

/**
 * A rule that blocks deployments during configured maintenance windows.
 *
 * This rule prevents deployments during scheduled maintenance periods for
 * dependent systems, preventing conflicts with infrastructure or service updates.
 *
 * @example
 * ```ts
 * // Block deployments during a scheduled database maintenance window
 * new MaintenanceWindowRule([
 *   {
 *     name: "Database Maintenance",
 *     start: new Date("2025-03-15T22:00:00Z"),
 *     end: new Date("2025-03-16T02:00:00Z")
 *   }
 * ]);
 * ```
 */
export class MaintenanceWindowRule implements DeploymentResourceRule {
  public readonly name = "MaintenanceWindowRule";

  constructor(private maintenanceWindows: MaintenanceWindow[]) {}

  // For testing: allow injecting a custom "now" timestamp
  protected getCurrentTime(): Date {
    return new Date();
  }

  filter(
    _: DeploymentResourceContext,
    releases: Releases,
  ): DeploymentResourceRuleResult {
    const now = this.getCurrentTime();

    // Find active maintenance windows that apply to this resource/deployment
    const activeWindows = this.maintenanceWindows.filter((window) => {
      // Validate start date is before end date
      const isValid = window.start <= window.end;
      // Check if window is currently active
      const isActive = isValid && now >= window.start && now <= window.end;
      return isActive;
    });

    if (activeWindows.length > 0) {
      const windowNames = activeWindows.map((w) => w.name).join(", ");
      return {
        allowedReleases: Releases.empty(),
        reason: `Deployment blocked due to active maintenance window(s): ${windowNames}`,
      };
    }

    return { allowedReleases: releases };
  }
}
