import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

/**
 * Type representing a dependency check function.
 * Returns true if dependency is satisfied, false otherwise.
 */
export type DependencyCheckFunction = (
  context: DeploymentResourceContext,
  release: Release,
) => Promise<{ satisfied: boolean; message?: string }>;

/**
 * Options for configuring the DependencyCheckRule
 */
export type DependencyCheckRuleOptions = {
  /**
   * Map of dependency names to check functions
   */
  dependencyChecks: Record<string, DependencyCheckFunction>;
};

/**
 * A rule that ensures dependent services or systems are in the correct state before deployment.
 *
 * This rule allows defining custom checks that ensure other services or infrastructure
 * dependencies are in a valid state before allowing deployment.
 *
 * @example
 * ```ts
 * // Ensure database migrations are completed before service deployment
 * new DependencyCheckRule({
 *   dependencyChecks: {
 *     "database-migrations": async (ctx, release) => {
 *       const migrationStatus = await getDatabaseMigrationStatus(release.version.tag);
 *       return { 
 *         satisfied: migrationStatus === "completed",
 *         message: migrationStatus !== "completed" ? 
 *           "Database migrations must be completed before deployment" : undefined
 *       };
 *     }
 *   }
 * });
 * ```
 */
export class DependencyCheckRule implements DeploymentResourceRule {
  public readonly name = "DependencyCheckRule";

  constructor(
    private options: DependencyCheckRuleOptions,
  ) {}

  /**
   * Filters releases based on the satisfaction of all dependency checks
   * @param ctx - Context containing information about the deployment and resource
   * @param currentCandidates - List of releases to filter
   * @returns Promise resolving to the filtered list of releases and optional reason if blocked
   */
  async filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): Promise<DeploymentResourceRuleResult> {
    const { dependencyChecks } = this.options;
    const dependencyNames = Object.keys(dependencyChecks);
    
    // If no dependency checks defined, pass through all candidates
    if (dependencyNames.length === 0) {
      return { allowedReleases: currentCandidates };
    }

    const allowedReleases: Release[] = [];
    const blockedReleases: { release: Release; reasons: string[] }[] = [];

    // Check each release against all dependency checks
    for (const release of currentCandidates) {
      const failedChecks: string[] = [];

      for (const [name, checkFn] of Object.entries(dependencyChecks)) {
        const result = await checkFn(ctx, release);
        
        if (!result.satisfied) {
          failedChecks.push(
            result.message ?? `Dependency "${name}" check failed`
          );
        }
      }

      if (failedChecks.length === 0) {
        allowedReleases.push(release);
      } else {
        blockedReleases.push({ release, reasons: failedChecks });
      }
    }

    if (allowedReleases.length === 0 && blockedReleases.length > 0) {
      // Provide details about the first blocked release
      const firstBlocked = blockedReleases[0];
      const reasons = firstBlocked?.reasons ?? ["Unknown dependency check failed"];
      return {
        allowedReleases: [],
        reason: `Dependency checks failed: ${reasons.join(", ")}`
      };
    }

    return { allowedReleases };
  }
}
