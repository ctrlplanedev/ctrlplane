import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

type DeploymentResourceSelectorOptions = object;

export class DeploymentResourceSelectorRule implements DeploymentResourceRule {
  public readonly name = "DeploymentResourceSelectorRule";

  constructor(private options: DeploymentResourceSelectorOptions) {}

  filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): DeploymentResourceRuleResult {
    if (ctx.deployment.resourceSelector) {
      // TODO: Implement resource validation
      return {
        allowedReleases: [],
        reason: "Resource validation failed",
      };
    }

    return {
      allowedReleases: currentCandidates,
      reason: "Resource validation passed",
    };
  }
}
