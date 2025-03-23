import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceSelectionResult,
  Release,
} from "./types.js";

/**
 * The RuleEngine applies a sequence of deployment rules to filter candidate releases
 * and selects the most appropriate release based on configured criteria.
 * 
 * The engine works by passing releases through each rule in sequence, where each rule
 * can filter out releases that don't meet specific criteria. After all rules have been
 * applied, a final selection strategy is used to choose the best remaining release.
 * 
 * @example
 * ```typescript
 * // Import necessary rules
 * import { 
 *   RuleEngine, 
 *   ApprovalRequiredRule,
 *   TimeWindowRule,
 *   VersionCooldownRule
 * } from '@ctrlplane/rule-engine';
 * 
 * // Create rules with appropriate options
 * const rules = [
 *   new ApprovalRequiredRule({
 *     environmentPattern: /^prod-/,
 *     approvalMetadataKey: 'approved_by',
 *     requiredApprovers: 2
 *   }),
 *   new TimeWindowRule({
 *     windows: [{
 *       days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
 *       startTime: '10:00',
 *       endTime: '16:00',
 *       timezone: 'America/New_York'
 *     }]
 *   }),
 *   new VersionCooldownRule({
 *     minTimeAfterCreation: 24 * 60 * 60 * 1000 // 24 hours
 *   })
 * ];
 * 
 * // Create the rule engine
 * const ruleEngine = new RuleEngine(rules);
 * 
 * // Evaluate a deployment context
 * const result = await ruleEngine.evaluate({
 *   desiredReleaseId: 'release-123',
 *   deployment: { id: 'deploy-456', name: 'prod-api' },
 *   resource: { id: 'resource-789', name: 'api-service' },
 *   availableReleases: [
 *     // Array of available releases to choose from
 *   ]
 * });
 * 
 * // Handle the result
 * if (result.allowed) {
 *   console.log(`Deployment allowed with release: ${result.chosenRelease.id}`);
 * } else {
 *   console.log(`Deployment denied: ${result.reason}`);
 * }
 * ```
 */
export class RuleEngine {
  /**
   * Creates a new RuleEngine with the specified rules.
   * 
   * @param rules - An array of rules that implement the DeploymentResourceRule interface.
   *                These rules will be applied in sequence during evaluation.
   */
  constructor(private rules: DeploymentResourceRule[]) {}
  
  /**
   * Evaluates a deployment context against all configured rules to determine
   * if the deployment is allowed and which release should be used.
   * 
   * The evaluation process:
   * 1. Starts with all available releases as candidates
   * 2. Applies each rule in sequence, updating the candidate list after each rule
   * 3. If any rule disqualifies all candidates, evaluation stops with a denial result
   * 4. After all rules pass, selects the final release using the configured selection strategy
   * 
   * @param context - The deployment context containing all information needed for rule evaluation
   * @returns A promise resolving to the evaluation result, including allowed status and chosen release
   * 
   * @example
   * ```typescript
   * const result = await ruleEngine.evaluate({
   *   desiredReleaseId: 'release-123',
   *   deployment: { id: 'deploy-456', name: 'prod-api' },
   *   resource: { id: 'resource-789', name: 'api-service' },
   *   availableReleases: [
   *     {
   *       id: 'release-123',
   *       createdAt: new Date('2023-01-01'),
   *       version: {
   *         tag: '1.0.0',
   *         config: '{}',
   *         metadata: { approved_by: 'user1,user2' },
   *         statusHistory: { deployment: 'succeeded' }
   *       },
   *       variables: {}
   *     },
   *     // Other available releases...
   *   ]
   * });
   * ```
   */
  async evaluate(
    context: DeploymentResourceContext,
  ): Promise<DeploymentResourceSelectionResult> {
    let candidateReleases = [...context.availableReleases];

    // Apply each rule in sequence to filter candidate releases
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

    // Once all rules pass, select the final release
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
   * Selects the most appropriate release from the candidate list after all rules have been applied.
   * 
   * The selection strategy follows these priorities:
   * 1. If a desiredReleaseId is specified and it's in the candidate list, that release is selected
   * 2. Otherwise, the newest release (by createdAt timestamp) is selected
   * 
   * This selection logic provides a balance between respecting explicit release requests and
   * defaulting to the latest available release when no specific preference is indicated.
   * 
   * @param context - The deployment context containing the desired release ID if specified
   * @param candidates - The list of release candidates that passed all rules
   * @returns The selected release, or undefined if no suitable release can be chosen
   * 
   * @example
   * ```typescript
   * // With a desired release specified
   * const context = {
   *   desiredReleaseId: 'release-123',
   *   // other context properties...
   * };
   * const candidates = [
   *   { id: 'release-123', createdAt: new Date('2023-01-01') },
   *   { id: 'release-456', createdAt: new Date('2023-02-01') }
   * ];
   * // Will select release-123 even though it's older
   * 
   * // Without a desired release specified
   * const context = {
   *   desiredReleaseId: undefined,
   *   // other context properties...
   * };
   * // Will select release-456 because it's the newest
   * ```
   * @private
   */
  private selectFinalRelease(
    context: DeploymentResourceContext,
    candidates: Release[],
  ): Release | undefined {
    // If no candidates remain after applying all rules
    if (candidates.length === 0) {
      return undefined;
    }
    
    // If a desiredVersion is specified and it's still in the candidates, choose it
    if (
      context.desiredReleaseId &&
      candidates.map((r) => r.id).includes(context.desiredReleaseId)
    ) {
      return candidates.find((r) => r.id === context.desiredReleaseId);
    }

    // Otherwise pick the newest release by createdAt timestamp
    const sorted = candidates.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return sorted[0];
  }
}