import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

/**
 * Function to get count of resources in environments
 */
export type GetResourceCountFunction = (
  environments: string[],
) => Promise<number> | number;

/**
 * Function to get count of successful deployments
 */
export type GetSuccessfulDeploymentsFunction = (
  releaseId: string,
  environmentIds: string[],
) => Promise<number> | number;

/**
 * Options for configuring the PreviousDeployStatusRule
 */
export type PreviousDeployStatusRuleOptions = {
  /**
   * List of environment IDs that must have successful deployments
   */
  dependentEnvironments: { name: string; id: string }[];

  /**
   * Minimum number of resources that must be successfully deployed
   */
  minSuccessfulDeployments?: number;

  /**
   * If true, all resources in the dependent environments must be deployed
   */
  requireAllResources?: boolean;

  /**
   * Function to get count of resources in environments
   */
  getResourceCount?: GetResourceCountFunction;

  /**
   * Function to get count of successful deployments
   */
  getSuccessfulDeployments?: GetSuccessfulDeploymentsFunction;
};

const getResourceCount: GetResourceCountFunction = (_: string[]) => {
  // TODO: Sum of all resources in the dependent environments
  return 0;
};

const getSuccessfulDeployments: GetSuccessfulDeploymentsFunction = (
  _: string,
  __: string[],
) => {
  // TODO: Count of successful deployments in the dependent environments
  return 0;
};

/**
 * A rule that ensures a minimum number of resources in dependent environments
 * are successfully deployed before allowing a release.
 *
 * This rule can be used to enforce deployment gates between environments, such
 * as requiring QA deployments before PROD.
 *
 * @example
 * ```ts
 * // Require at least 5 successful deployments in QA before PROD
 * new PreviousDeployStatusRule({
 *   dependentEnvironments: [{ name: "qa", id: "qa" }],
 *   minSuccessfulDeployments: 5
 * });
 *
 * // Require ALL resources in STAGING to be successfully deployed first
 * new PreviousDeployStatusRule({
 *   dependentEnvironments: [{ name: "staging", id: "staging" }],
 *   requireAllResources: true
 * });
 * ```
 */
export class PreviousDeployStatusRule implements DeploymentResourceRule {
  public readonly name = "PreviousDeployStatusRule";
  private getResourceCount: GetResourceCountFunction;
  private getSuccessfulDeployments: GetSuccessfulDeploymentsFunction;

  constructor(private options: PreviousDeployStatusRuleOptions) {
    // Set default values
    if (
      this.options.requireAllResources == null &&
      this.options.minSuccessfulDeployments == null
    ) {
      this.options.minSuccessfulDeployments = 0;
    }

    // Set default get functions if not provided
    this.getResourceCount = options.getResourceCount ?? getResourceCount;
    this.getSuccessfulDeployments =
      options.getSuccessfulDeployments ?? getSuccessfulDeployments;
  }

  async filter(
    _: DeploymentResourceContext,
    currentCandidates: Release[],
  ): Promise<DeploymentResourceRuleResult> {
    const {
      dependentEnvironments,
      minSuccessfulDeployments,
      requireAllResources,
    } = this.options;

    const hasDependentEnvironments = dependentEnvironments.length > 0;
    const hasMinimumRequirement =
      (minSuccessfulDeployments ?? 0) > 0 || requireAllResources;

    if (!hasDependentEnvironments || !hasMinimumRequirement)
      return { allowedReleases: currentCandidates };

    const requiredDeployments = requireAllResources
      ? await this.getResourceCount(dependentEnvironments.map(({ id }) => id))
      : (minSuccessfulDeployments ?? 0);

    // Process all releases in parallel and get deployment counts
    const releaseChecks = await Promise.all(
      currentCandidates.map(async (release) => ({
        release,
        successfulDeployments: await this.getSuccessfulDeployments(
          release.id,
          dependentEnvironments.map(({ id }) => id),
        ),
      })),
    );

    // Filter allowed releases
    const allowedReleases = releaseChecks
      .filter(
        ({ successfulDeployments }) =>
          successfulDeployments >= requiredDeployments,
      )
      .map(({ release }) => release);

    if (allowedReleases.length > 0) return { allowedReleases };

    // If no releases allowed, find best candidate and return reason
    const bestCandidate = releaseChecks.reduce((best, current) =>
      current.successfulDeployments > best.successfulDeployments
        ? current
        : best,
    );

    const envNames = dependentEnvironments.map(({ name }) => name).join(", ");
    const reasonMessage = this.options.requireAllResources
      ? `Not all resources in ${envNames} have been successfully deployed for any release candidate. Best candidate (${bestCandidate.release.id}) has ${bestCandidate.successfulDeployments}/${requiredDeployments} deployments.`
      : `Minimum deployment requirement not met for any release candidate. Need at least ${requiredDeployments} successful deployments in ${envNames}. Best candidate (${bestCandidate.release.id}) has ${bestCandidate.successfulDeployments} deployments.`;

    return {
      allowedReleases: [],
      reason: reasonMessage,
    };
  }
}
