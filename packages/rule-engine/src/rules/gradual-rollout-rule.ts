import { addMinutes, isAfter, isEqual, startOfMinute } from "date-fns";

import type { Version } from "../manager/version-rule-engine";
import type { FilterRule, RuleEngineRuleResult } from "../types";

type GradualRolloutRuleOptions = {
  deployRate: number;
  windowSizeMinutes: number;
  getRolloutStartTime: (version: Version) => Date | Promise<Date>;
  getReleaseTargetPosition: (version: Version) => number | Promise<number>;
  skipReason?: string;
};

export class GradualRolloutRule implements FilterRule<Version> {
  public readonly name = "GradualRolloutRule";

  constructor(private readonly options: GradualRolloutRuleOptions) {
    if (this.options.deployRate <= 0) {
      throw new Error("Deploy rate must be greater than 0");
    }
    if (this.options.windowSizeMinutes <= 0) {
      throw new Error("Window size must be greater than 0");
    }
  }

  protected getCurrentTime() {
    return new Date();
  }

  async getDeploymentTime(version: Version) {
    const startTime = await this.options.getRolloutStartTime(version);
    const targetPosition = await this.options.getReleaseTargetPosition(version);
    const windowPosition = Math.floor(targetPosition / this.options.deployRate);
    return addMinutes(
      startOfMinute(startTime),
      windowPosition * this.options.windowSizeMinutes,
    );
  }

  async filter(candidates: Version[]): Promise<RuleEngineRuleResult<Version>> {
    const now = this.getCurrentTime();
    const rejectionReasons = new Map<string, string>();
    const skip =
      this.options.skipReason ??
      "Version not eligible for deployment in the current time window";

    for (const candidate of candidates) {
      const deploymentTime = await this.getDeploymentTime(candidate);
      const isEligible =
        isAfter(now, deploymentTime) || isEqual(now, deploymentTime);
      if (!isEligible) rejectionReasons.set(candidate.id, skip);
    }

    return {
      allowedCandidates: candidates.filter((c) => !rejectionReasons.has(c.id)),
      rejectionReasons,
    };
  }
}
