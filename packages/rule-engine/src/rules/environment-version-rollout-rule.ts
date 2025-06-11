import { addMinutes, isAfter, isEqual, startOfMinute } from "date-fns";

import * as schema from "@ctrlplane/db/schema";

import type { Version } from "../manager/version-rule-engine.js";
import type { FilterRule, RuleEngineRuleResult } from "../types.js";

type GetDeploymentOffsetMinutes = (targetPosition: number) => number;

type OffsetFunctionGetter = (
  positionGrowthFactor: number,
  timeScaleInterval: number,
) => GetDeploymentOffsetMinutes;

const linearDeploymentOffset: OffsetFunctionGetter =
  (
    positionGrowthFactor: number,
    timeScaleInterval: number,
  ): GetDeploymentOffsetMinutes =>
  (x: number) =>
    timeScaleInterval * (x / positionGrowthFactor);

const exponentialDeploymentOffset: OffsetFunctionGetter =
  (
    positionGrowthFactor: number,
    timeScaleInterval: number,
  ): GetDeploymentOffsetMinutes =>
  (x: number) =>
    timeScaleInterval * (Math.exp(x / positionGrowthFactor) - 1);

export const RolloutTypeToOffsetFunction: Record<
  schema.RolloutType,
  OffsetFunctionGetter
> = {
  [schema.RolloutType.Linear]: linearDeploymentOffset,
  [schema.RolloutType.Exponential]: exponentialDeploymentOffset,
};

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
