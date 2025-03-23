import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

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

  constructor(
    private maintenanceWindows: Array<{
      name: string;
      start: Date;
      end: Date;
    }>,
  ) {}

  filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): DeploymentResourceRuleResult {
    const now = new Date();

    // Find active maintenance windows that apply to this resource/deployment
    const activeWindows = this.maintenanceWindows.filter((window) => {
      const isActive = now >= window.start && now <= window.end;
      return isActive;
    });

    if (activeWindows.length > 0) {
      const windowNames = activeWindows.map((w) => w.name).join(", ");
      return {
        allowedReleases: [],
        reason: `Deployment blocked due to active maintenance window(s): ${windowNames}`,
      };
    }

    return { allowedReleases: currentCandidates };
  }
}
