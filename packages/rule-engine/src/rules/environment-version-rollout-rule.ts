import { addMinutes, isAfter, isEqual, startOfMinute } from "date-fns";

import type { Version } from "../manager/version-rule-engine";
import type { FilterRule, RuleEngineRuleResult } from "../types";

type GetDeploymentOffsetMinutes = (targetPosition: number) => number;

export const linearDeploymentOffset =
  (
    positionGrowthFactor: number,
    timeScaleInterval: number,
  ): GetDeploymentOffsetMinutes =>
  (x: number) =>
    timeScaleInterval * (x / positionGrowthFactor);

export const exponentialDeploymentOffset =
  (
    positionGrowthFactor: number,
    timeScaleInterval: number,
  ): GetDeploymentOffsetMinutes =>
  (x: number) =>
    timeScaleInterval * (1 - Math.exp(-1 * (x / positionGrowthFactor)));

type EnvironmentVersionRolloutRuleOptions = {
  getRolloutStartTime: (version: Version) => Date | Promise<Date | null> | null;
  getReleaseTargetPosition: (version: Version) => number | Promise<number>;
  getDeploymentOffsetMinutes: GetDeploymentOffsetMinutes;
  skipReason?: string;
};

export class EnvironmentVersionRolloutRule implements FilterRule<Version> {
  public readonly name = "EnvironmentVersionRolloutRule";

  constructor(private readonly options: EnvironmentVersionRolloutRuleOptions) {}

  protected getCurrentTime() {
    return new Date();
  }

  async getDeploymentTime(version: Version, startTime: Date) {
    const targetPosition = await this.options.getReleaseTargetPosition(version);
    const minutes = this.options.getDeploymentOffsetMinutes(targetPosition);
    return addMinutes(startOfMinute(startTime), minutes);
  }

  async filter(candidates: Version[]): Promise<RuleEngineRuleResult<Version>> {
    const now = this.getCurrentTime();
    const rejectionReasons = new Map<string, string>();
    const skip =
      this.options.skipReason ??
      "Version not eligible for deployment in the current time window";

    for (const candidate of candidates) {
      const startTime = await this.options.getRolloutStartTime(candidate);
      if (startTime == null) {
        rejectionReasons.set(
          candidate.id,
          "Rollout has not started for this version",
        );
        continue;
      }
      const deploymentTime = await this.getDeploymentTime(candidate, startTime);

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
