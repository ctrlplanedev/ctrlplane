import * as schema from "@ctrlplane/db/schema";

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
