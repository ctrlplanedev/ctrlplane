import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
} from "../types.js";
import { Releases } from "../utils/releases.js";

type DeploymentVersionSelectorOptions = object;

export class DeploymentVersionSelectorRule implements DeploymentResourceRule {
  public readonly name = "DeploymentVersionSelectorRule";

  constructor(private _: DeploymentVersionSelectorOptions) {}

  filter(
    ctx: DeploymentResourceContext,
    releases: Releases,
  ): DeploymentResourceRuleResult {
    if (ctx.deployment.versionSelector) {
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
