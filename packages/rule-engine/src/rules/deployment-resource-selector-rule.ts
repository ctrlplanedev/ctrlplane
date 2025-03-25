import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
} from "../types.js";
import { Releases } from "../utils/releases.js";

type DeploymentResourceSelectorOptions = object;

export class DeploymentResourceSelectorRule implements DeploymentResourceRule {
  public readonly name = "DeploymentResourceSelectorRule";

  constructor(private options: DeploymentResourceSelectorOptions) {}

  filter(
    ctx: DeploymentResourceContext,
    releases: Releases,
  ): DeploymentResourceRuleResult {
    if (ctx.deployment.resourceSelector) {
      // TODO: Implement resource validation
      return {
        allowedReleases: Releases.empty(),
        reason: "Resource validation failed",
      };
    }

    return {
      allowedReleases: releases,
      reason: "Resource validation passed",
    };
  }
}
