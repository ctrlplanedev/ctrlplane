import _ from "lodash";

import type {
  RuleEngine,
  RuleEngineContext,
  RuleEngineFilter,
  RuleEngineSelectionResult,
} from "./types.js";

export type Version = {
  id: string;
  tag: string;
  config: Record<string, any>;
  metadata: Record<string, string>;
  createdAt: Date;
};

/**
 * The RuleEngine applies a sequence of deployment rules to filter candidate
 * releases and selects the most appropriate release based on configured
 * criteria.
 *
 * The engine works by passing releases through each rule in sequence, where
 * each rule can filter out releases that don't meet specific criteria. After
 * all rules have been applied, a final selection strategy is used to choose the
 * best remaining release.
 */
export class VersionRuleEngine implements RuleEngine<Version> {
  /**
   * Creates a new RuleEngine with the specified rules.
   *
   * @param rules - An array of rules that implement the DeploymentResourceRule
   *                interface. These rules will be applied in sequence during
   *                evaluation.
   */
  constructor(
    private rules: Array<
      | (() => Promise<RuleEngineFilter<Version>> | RuleEngineFilter<Version>)
      | RuleEngineFilter<Version>
    >,
  ) {}

  /**
   * Evaluates a deployment context against all configured rules to determine if
   * the deployment is allowed and which release should be used.
   *
   * The evaluation process:
   * 1. Starts with all available releases as candidates
   * 2. Applies each rule in sequence, updating the candidate list after each
   *    rule
   * 3. If any rule disqualifies all candidates, evaluation stops with a denial
   *    result
   * 4. After all rules pass, selects the final release using the configured
   *    selection strategy
   *
   * Important implementation details for rule authors:
   * - Rules should return ALL valid candidate releases, not just one
   * - This ensures subsequent rules have a complete set of options to filter
   * - For example, if multiple sequential upgrades are required, all should be
   *   returned, not just the oldest one
   * - Otherwise, a subsequent rule might filter out the only returned
   *   candidate, even when other valid candidates existed
   *
   * @param releases - The releases to evaluate
   * @param context - The deployment context containing all information needed
   * for rule evaluation
   * @returns A promise resolving to the evaluation result, including allowed
   * status and chosen release
   */
  async evaluate(
    context: RuleEngineContext,
    candidates: Version[],
  ): Promise<RuleEngineSelectionResult<Version>> {
    // Track rejection reasons for each release across all rules
    let rejectionReasons = new Map<string, string>();

    // Apply each rule in sequence to filter candidate releases
    for (const rule of this.rules) {
      const result = await (
        typeof rule === "function" ? await rule() : rule
      ).filter(context, candidates);

      // If the rule yields no candidates, we must stop.
      if (result.allowedCandidates.length === 0) {
        return {
          chosenCandidate: null,
          rejectionReasons: result.rejectionReasons ?? rejectionReasons,
        };
      }

      // Merge any new rejection reasons with our tracking map
      if (result.rejectionReasons) {
        rejectionReasons = new Map([
          ...rejectionReasons,
          ...result.rejectionReasons,
        ]);
      }

      candidates = result.allowedCandidates;
    }

    // Once all rules pass, select the final release
    const chosen = this.selectFinalRelease(context, candidates);
    return chosen == null
      ? {
          chosenCandidate: null,
          rejectionReasons,
        }
      : {
          chosenCandidate: chosen,
          rejectionReasons,
        };
  }

  /**
   * Selects the most appropriate release from the candidate list after all
   * rules have been applied.
   *
   * The selection strategy follows these priorities:
   * 1. If sequential upgrade releases are present, select the oldest one
   * 2. If a desiredReleaseId is specified and it's in the candidate list, that
   *    release is selected
   * 3. Otherwise, the newest release (by createdAt timestamp) is selected
   *
   * This selection logic provides a balance between respecting explicit release
   * requests and defaulting to the latest available release when no specific
   * preference is indicated, while ensuring sequential upgrades are applied in
   * the correct order.
   *
   * @param context - The deployment context containing the desired release ID
   * if specified
   * @param candidates - The list of release candidates that passed all rules
   * @returns The selected release, or undefined if no suitable release can be
   * chosen
   */
  private selectFinalRelease(
    context: RuleEngineContext,
    candidates: Version[],
  ): Version | undefined {
    if (candidates.length === 0) {
      return undefined;
    }

    // First, check for sequential upgrades - if present, we must select the
    // oldest
    const sequentialReleases = this.findSequentialUpgradeReleases(candidates);
    return sequentialReleases.length > 0
      ? _.minBy(sequentialReleases, (v) => v.createdAt)
      : _.maxBy(candidates, (v) => v.createdAt);
  }

  /**
   * Identifies releases that require sequential upgrade application.
   *
   * Looks for the standard metadata flag that indicates a release requires
   * sequential upgrade application.
   *
   * @param releases - The releases to check
   * @returns A Releases collection with only sequential upgrade releases
   */
  private findSequentialUpgradeReleases(versions: Version[]): Version[] {
    // Look for the standard metadata key used by SequentialUpgradeRule
    return versions.filter(
      (v) => v.metadata.requiresSequentialUpgrade === "true",
    );
  }
}
