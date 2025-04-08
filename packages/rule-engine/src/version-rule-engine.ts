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
 * The VersionRuleEngine applies a sequence of rules to filter candidate versions
 * and selects the most appropriate version based on configured criteria.
 *
 * The engine works by passing versions through each rule in sequence, where each
 * rule can filter out versions that don't meet specific criteria. After all rules
 * have been applied, a final selection strategy is used to choose the best
 * remaining version.
 */
export class VersionRuleEngine implements RuleEngine<Version> {
  /**
   * Creates a new VersionRuleEngine with the specified rules.
   *
   * @param rules - An array of rules that implement the RuleEngineFilter<Version>
   *                interface. These rules will be applied in sequence during
   *                evaluation. Rules can be provided directly or as functions that
   *                return a rule or promise of a rule.
   */
  constructor(
    private rules: Array<
      | (() => Promise<RuleEngineFilter<Version>> | RuleEngineFilter<Version>)
      | RuleEngineFilter<Version>
    >,
  ) {}

  /**
   * Evaluates a context against all configured rules to determine which version
   * should be used.
   *
   * The evaluation process:
   * 1. Starts with all available versions as candidates
   * 2. Applies each rule in sequence, updating the candidate list after each rule
   * 3. If any rule disqualifies all candidates, evaluation stops with a null result
   * 4. After all rules pass, selects the final version using the configured
   *    selection strategy
   *
   * Important implementation details for rule authors:
   * - Rules should return ALL valid candidate versions, not just one
   * - This ensures subsequent rules have a complete set of options to filter
   * - For example, if multiple sequential upgrades are required, all should be
   *   returned, not just the oldest one
   * - Otherwise, a subsequent rule might filter out the only returned candidate,
   *   even when other valid candidates existed
   *
   * @param context - The context containing all information needed for rule evaluation
   * @param candidates - The versions to evaluate
   * @returns A promise resolving to the evaluation result, including chosen version
   * and any rejection reasons
   */
  async evaluate(
    context: RuleEngineContext,
    candidates: Version[],
  ): Promise<RuleEngineSelectionResult<Version>> {
    // Track rejection reasons for each version across all rules
    let rejectionReasons = new Map<string, string>();

    // Apply each rule in sequence to filter candidate versions
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

    // Once all rules pass, select the final version
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
   * Selects the most appropriate version from the candidate list after all rules
   * have been applied.
   *
   * The selection strategy follows these priorities:
   * 1. If sequential upgrade versions are present, select the oldest one
   * 2. Otherwise, select the newest version (by createdAt timestamp)
   *
   * This selection logic ensures sequential upgrades are applied in the correct
   * order while defaulting to the latest available version when no sequential
   * upgrades are required.
   *
   * @param context - The context for version selection
   * @param candidates - The list of version candidates that passed all rules
   * @returns The selected version, or undefined if no suitable version can be chosen
   */
  private selectFinalRelease(
    context: RuleEngineContext,
    candidates: Version[],
  ): Version | undefined {
    if (candidates.length === 0) {
      return undefined;
    }

    // First, check for sequential upgrades - if present, we must select the oldest
    const sequentialReleases = this.findSequentialUpgradeReleases(candidates);
    return sequentialReleases.length > 0
      ? _.minBy(sequentialReleases, (v) => v.createdAt)
      : _.maxBy(candidates, (v) => v.createdAt);
  }

  /**
   * Identifies versions that require sequential upgrade application.
   *
   * Looks for the standard metadata flag that indicates a version requires
   * sequential upgrade application.
   *
   * @param versions - The versions to check
   * @returns An array of versions that require sequential upgrades
   */
  private findSequentialUpgradeReleases(versions: Version[]): Version[] {
    // Look for the standard metadata key used by SequentialUpgradeRule
    return versions.filter(
      (v) => v.metadata.requiresSequentialUpgrade === "true",
    );
  }
}
