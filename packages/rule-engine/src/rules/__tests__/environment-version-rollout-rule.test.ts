import { addMinutes, differenceInMinutes, startOfMinute } from "date-fns";
import { describe, expect, it } from "vitest";

import * as schema from "@ctrlplane/db/schema";

import type { Version } from "../../manager/version-rule-engine.js";
import {
  EnvironmentVersionRolloutRule,
  RolloutTypeToOffsetFunction,
} from "../environment-version-rollout-rule.js";

describe("EnvironmentVersionRolloutRule", () => {
  describe("Linear Rollout", () => {
    it("should calculate correct offset time for linear rollout", () => {
      const positionGrowthFactor = 10;
      const timeScaleInterval = 60; // 60 minutes
      const getDeploymentOffsetMinutes = RolloutTypeToOffsetFunction[
        schema.RolloutType.Linear
      ](positionGrowthFactor, timeScaleInterval);

      // Test position 0 (should be 0 minutes)
      expect(getDeploymentOffsetMinutes(0)).toBe(0);

      // Test position 5 (should be 30 minutes)
      expect(getDeploymentOffsetMinutes(5)).toBe(30);

      // Test position 10 (should be 60 minutes)
      expect(getDeploymentOffsetMinutes(10)).toBe(60);
    });
  });

  describe("Exponential Rollout", () => {
    it("should calculate correct offset time for exponential rollout", () => {
      const positionGrowthFactor = 10;
      const timeScaleInterval = 60; // 60 minutes
      const getDeploymentOffsetMinutes = RolloutTypeToOffsetFunction[
        schema.RolloutType.Exponential
      ](positionGrowthFactor, timeScaleInterval);

      // Test position 0 (should be 0 minutes)
      expect(getDeploymentOffsetMinutes(0)).toBe(0);

      // Test position 5 (should be approximately 39 minutes)
      expect(getDeploymentOffsetMinutes(5)).toBeCloseTo(38.92, 1);

      // Test position 10 (should be approximately 103 minutes)
      expect(getDeploymentOffsetMinutes(10)).toBeCloseTo(103.09, 1);
    });
  });

  describe("Integration with EnvironmentVersionRolloutRule", () => {
    it("should correctly calculate deployment time for a version", async () => {
      const mockVersion: Version = {
        id: "ver-1",
        tag: "v1.0.0",
        config: {},
        createdAt: new Date("2024-01-01T00:00:00Z"),
      };

      const mockGetRolloutStartTime = () =>
        Promise.resolve(new Date("2024-01-01T00:00:00Z"));
      const mockGetReleaseTargetPosition = () => Promise.resolve(5);
      const getDeploymentOffsetMinutes = RolloutTypeToOffsetFunction[
        schema.RolloutType.Linear
      ](10, 60);

      const rule = new EnvironmentVersionRolloutRule({
        getRolloutStartTime: mockGetRolloutStartTime,
        getReleaseTargetPosition: mockGetReleaseTargetPosition,
        getDeploymentOffsetMinutes,
      });

      const startTime = await mockGetRolloutStartTime();
      const deploymentTime = await rule.getDeploymentTime(
        mockVersion,
        startTime,
      );

      // For linear rollout with position 5 and timeScaleInterval 60,
      // offset should be 30 minutes
      const expectedTime = addMinutes(startOfMinute(startTime), 30);
      expect(deploymentTime).toEqual(expectedTime);
    });

    it("should handle exponential rollout in integration test", async () => {
      const mockVersion: Version = {
        id: "ver-1",
        tag: "v1.0.0",
        config: {},
        createdAt: new Date("2024-01-01T00:00:00Z"),
      };

      const mockGetRolloutStartTime = () =>
        Promise.resolve(new Date("2024-01-01T00:00:00Z"));
      const mockGetReleaseTargetPosition = () => Promise.resolve(5);
      const getDeploymentOffsetMinutes = RolloutTypeToOffsetFunction[
        schema.RolloutType.Exponential
      ](10, 60);

      const rule = new EnvironmentVersionRolloutRule({
        getRolloutStartTime: mockGetRolloutStartTime,
        getReleaseTargetPosition: mockGetReleaseTargetPosition,
        getDeploymentOffsetMinutes,
      });

      const startTime = await mockGetRolloutStartTime();
      const deploymentTime = await rule.getDeploymentTime(
        mockVersion,
        startTime,
      );

      const offsetInMinutes = differenceInMinutes(deploymentTime, startTime);
      expect(offsetInMinutes).toBeCloseTo(38, 1);
    });
  });
});
