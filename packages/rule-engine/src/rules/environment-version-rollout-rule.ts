import { addMinutes, isAfter, isEqual, startOfMinute } from "date-fns";

import * as schema from "@ctrlplane/db/schema";

import type { Version } from "../manager/version-rule-engine.js";
import type { FilterRule, RuleEngineRuleResult } from "../types.js";

type GetDeploymentOffsetMinutes = (targetPosition: number) => number;

type OffsetFunctionGetter = (
  positionGrowthFactor: number,
  timeScaleInterval: number,
  numReleaseTargets: number,
) => GetDeploymentOffsetMinutes;

const linearDeploymentOffset: OffsetFunctionGetter =
  (
    _: number,
    timeScaleInterval: number,
    __: number,
  ): GetDeploymentOffsetMinutes =>
  (x: number) =>
    timeScaleInterval * x;

const linearDeploymentOffsetNormalized: OffsetFunctionGetter =
  (
    _: number,
    timeScaleInterval: number,
    numReleaseTargets: number,
  ): GetDeploymentOffsetMinutes =>
  (x: number) =>
    timeScaleInterval * (x / numReleaseTargets);

const exponentialDeploymentOffset: OffsetFunctionGetter =
  (
    positionGrowthFactor: number,
    timeScaleInterval: number,
    _: number,
  ): GetDeploymentOffsetMinutes =>
  (x: number) =>
    timeScaleInterval * (1 - Math.exp(-x / positionGrowthFactor));

const exponentialDeploymentOffsetNormalized: OffsetFunctionGetter =
  (
    positionGrowthFactor: number,
    timeScaleInterval: number,
    numReleaseTargets: number,
  ): GetDeploymentOffsetMinutes =>
  (x: number) =>
    timeScaleInterval *
    ((1 - Math.exp(-x / numReleaseTargets)) /
      (1 - Math.exp(-numReleaseTargets / positionGrowthFactor)));

export const RolloutTypeToOffsetFunction: Record<
  schema.RolloutType,
  OffsetFunctionGetter
> = {
  [schema.RolloutType.Linear]: linearDeploymentOffset,
  [schema.RolloutType.Exponential]: exponentialDeploymentOffset,
  [schema.RolloutType.LinearNormalized]: linearDeploymentOffsetNormalized,
  [schema.RolloutType.ExponentialNormalized]:
    exponentialDeploymentOffsetNormalized,
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
