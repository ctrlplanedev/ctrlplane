import { addMinutes, addSeconds } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedRelease } from "../../types.js";
import { Releases } from "../../releases.js";
import { RateRolloutRule } from "../rate-rollout-rule.js";

describe("RateRolloutRule", () => {
  const mockDeploymentContext = {
    desiredReleaseId: null,
    deployment: {
      id: "deployment-1",
      name: "Test Deployment",
    },
    environment: {
      id: "env-1",
      name: "Test Environment",
    },
    resource: {
      id: "resource-1",
      name: "Test Resource",
    },
  };

  // Set a fixed base date for testing
  const baseDate = new Date("2025-01-01T00:00:00Z");

  beforeEach(() => vi.resetAllMocks());

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockRelease: ResolvedRelease = {
    id: "1",
    createdAt: baseDate,
    version: {
      id: "1",
      tag: "1",
      config: {},
      metadata: {},
      createdAt: baseDate,
    },
    variables: {},
  };

  it("should allow a release if their rollout period is complete", () => {
    const rule = new RateRolloutRule({ rolloutDurationSeconds: 600 });
    const now = addMinutes(baseDate, 10);
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(now);

    vi.spyOn(rule as any, "getHashValue").mockReturnValue(100);

    const result = rule.filter(
      mockDeploymentContext,
      new Releases([mockRelease]),
    );

    expect(result.allowedReleases.getAll().length).toBe(1);
    expect(result.rejectionReasons).toEqual(new Map());
  });

  it("should allow a release if the hash is less than or equal to the rollout percentage", () => {
    const rule = new RateRolloutRule({ rolloutDurationSeconds: 600 });
    const now = addSeconds(baseDate, 300);
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(now);

    vi.spyOn(rule as any, "getHashValue").mockReturnValue(50);

    const result = rule.filter(
      mockDeploymentContext,
      new Releases([mockRelease]),
    );

    expect(result.allowedReleases.getAll().length).toBe(1);
    expect(result.rejectionReasons).toEqual(new Map());
  });

  it("should reject a release if the hash is greater than the rollout percentage", () => {
    const rolloutDurationSeconds = 600;
    const nowSecondsAfterBase = 300;
    const rule = new RateRolloutRule({ rolloutDurationSeconds });
    const now = addSeconds(baseDate, nowSecondsAfterBase);
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(now);

    vi.spyOn(rule as any, "getHashValue").mockReturnValue(51);

    const result = rule.filter(
      mockDeploymentContext,
      new Releases([mockRelease]),
    );

    expect(result.allowedReleases.getAll().length).toBe(0);
    const expectedRejectionReason = `Release denied due to rate-based rollout restrictions (${Math.round(
      (nowSecondsAfterBase / rolloutDurationSeconds) * 100,
    )}% complete, eligible in ~5m)`;
    expect(result.rejectionReasons).toEqual(
      new Map([[mockRelease.id, expectedRejectionReason]]),
    );
  });
});
