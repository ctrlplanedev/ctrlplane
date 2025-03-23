import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceSelectionResult,
  Release,
} from "./types.js";

/**
 * The engine that applies rules in sequence, then picks a version.
 */
export class RuleEngine {
  constructor(private rules: DeploymentResourceRule[]) {}

  async evaluate(
    context: DeploymentResourceContext,
  ): Promise<DeploymentResourceSelectionResult> {
    let candidateReleases = [...context.availableReleases];

    for (const rule of this.rules) {
      const result = await rule.filter(context, candidateReleases);

      // If the rule yields no candidates, we must stop.
      if (result.allowedReleases.length === 0) {
        return {
          allowed: false,
          reason: `${rule.name} disqualified all versions. Additional info: ${result.reason ?? ""}`,
        };
      }

      candidateReleases = [...result.allowedReleases];
    }

    const chosen = this.selectFinalRelease(context, candidateReleases);
    if (!chosen) {
      return {
        allowed: false,
        reason: `No suitable version chosen after applying all rules.`,
      };
    }

    return {
      allowed: true,
      chosenRelease: chosen,
    };
  }

  /**
   * Tiebreak logic or final selection strategy.
   *
   * Examples:
   *  - If a desiredVersion is in the list, pick it
   *  - Or pick the newest createdAt, etc.
   */
  private selectFinalRelease(
    context: DeploymentResourceContext,
    candidates: Release[],
  ): Release | undefined {
    // If a desiredVersion is specified and it's still in the candidates, choose
    // it:
    if (
      context.desiredReleaseId &&
      candidates.map((r) => r.id).includes(context.desiredReleaseId)
    )
      return candidates.find((r) => r.id === context.desiredReleaseId);

    // Otherwise pick the newest release.
    const sorted = candidates.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return sorted[0];
  }
}