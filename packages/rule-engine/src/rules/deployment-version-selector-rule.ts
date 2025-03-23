import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

type DeploymentVersionSelectorOptions = object;

export class DeploymentVersionSelectorRule implements DeploymentResourceRule {
  public readonly name = "DeploymentVersionSelectorRule";

  constructor(private options: DeploymentVersionSelectorOptions) {}

  filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): DeploymentResourceRuleResult {
    if (ctx.deployment.versionSelector) {
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
