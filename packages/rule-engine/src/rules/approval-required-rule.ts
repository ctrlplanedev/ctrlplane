import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

/**
 * A rule that requires explicit approval for specific versions or environments.
 *
 * This rule ensures that certain deployments can only proceed after receiving
 * explicit approval, which can be tracked in release metadata.
 *
 * @example
 * ```ts
 * // Require approval for production deployments
 * new ApprovalRequiredRule({
 *   environmentPattern: /^prod-/,
 *   approvalMetadataKey: "approved_by"
 * });
 * ```
 */
export class ApprovalRequiredRule implements DeploymentResourceRule {
  public readonly name = "ApprovalRequiredRule";

  constructor(
    private options: {
      environmentPattern?: RegExp;
      resourcePattern?: RegExp;
      versionPattern?: RegExp;
      approvalMetadataKey: string;
      requiredApprovers?: number;
    },
  ) {}

  async filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): Promise<DeploymentResourceRuleResult> {
    // Skip approval check if deployment environment/resource doesn't match our patterns
    if (
      this.options.environmentPattern &&
      !this.options.environmentPattern.test(ctx.deployment.name)
    ) {
      return { allowedReleases: currentCandidates };
    }

    if (
      this.options.resourcePattern &&
      !this.options.resourcePattern.test(ctx.resource.name)
    ) {
      return { allowedReleases: currentCandidates };
    }

    // Filter releases that require approval
    const filteredReleases = currentCandidates.filter((release) => {
      // If we have a version pattern and it doesn't match, no approval needed
      if (
        this.options.versionPattern &&
        !this.options.versionPattern.test(release.version.tag)
      ) {
        return true;
      }

      // Check for approval in metadata
      const approvalValue =
        release.version.metadata?.[this.options.approvalMetadataKey];

      // If no approval data found, can't deploy
      if (!approvalValue) {
        return false;
      }

      // If we require a specific number of approvers
      if (this.options.requiredApprovers) {
        // Check if the approval value has multiple approvers (comma-separated list)
        const approvers = approvalValue
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
        return approvers.length >= this.options.requiredApprovers;
      }

      // Otherwise any approval is sufficient
      return true;
    });

    if (filteredReleases.length === 0) {
      return {
        allowedReleases: [],
        reason: `Required approval is missing. Deployment to ${ctx.deployment.name}/${ctx.resource.name} requires explicit approval via the '${this.options.approvalMetadataKey}' metadata field.`,
      };
    }

    return { allowedReleases: filteredReleases };
  }
}