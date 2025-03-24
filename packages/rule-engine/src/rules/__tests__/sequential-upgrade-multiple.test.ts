import { describe, expect, it } from "vitest";

import type { DeploymentResourceContext, Release } from "../../types.js";
import { Releases } from "../../utils/releases.js";
import { SequentialUpgradeRule } from "../sequential-upgrade-rule.js";

describe("SequentialUpgradeRule with multiple sequential releases", () => {
  // Test data setup
  const oldestSequentialRelease: Release = {
    id: "release-1",
    createdAt: new Date("2023-01-01"),
    version: {
      tag: "1.0.0",
      config: "{}",
      metadata: { requiresSequentialUpgrade: "true" },
      statusHistory: {},
    },
    variables: {},
  };

  const middleSequentialRelease: Release = {
    id: "release-2",
    createdAt: new Date("2023-02-01"),
    version: {
      tag: "1.1.0",
      config: "{}",
      metadata: { requiresSequentialUpgrade: "true" },
      statusHistory: {},
    },
    variables: {},
  };

  const newestSequentialRelease: Release = {
    id: "release-3",
    createdAt: new Date("2023-03-01"),
    version: {
      tag: "1.2.0",
      config: "{}",
      metadata: { requiresSequentialUpgrade: "true" },
      statusHistory: {},
    },
    variables: {},
  };

  const nonSequentialRelease: Release = {
    id: "release-4",
    createdAt: new Date("2023-04-01"),
    version: {
      tag: "2.0.0",
      config: "{}",
      metadata: {},
      statusHistory: {},
    },
    variables: {},
  };

  const allReleases = [
    oldestSequentialRelease,
    middleSequentialRelease,
    newestSequentialRelease,
    nonSequentialRelease,
  ];

  // Basic context with all releases
  const context: DeploymentResourceContext = {
    desiredReleaseId: nonSequentialRelease.id,
    deployment: { id: "deploy-1", name: "test-deploy" },
    environment: { id: "env-1", name: "test-env" },
    resource: { id: "resource-1", name: "test-resource" },
    availableReleases: allReleases,
  };

  const rule = new SequentialUpgradeRule();

  it("should return all sequential releases when targeting a non-sequential release", async () => {
    // Targeting the non-sequential release
    const ctxWithNonSequentialTarget = {
      ...context,
      desiredReleaseId: nonSequentialRelease.id,
    };

    const candidates = new Releases(allReleases);
    const result = rule.filter(ctxWithNonSequentialTarget, candidates);

    // Should allow both sequential releases since they both need to be applied
    expect(result.allowedReleases.length).toBe(3);

    // Verify all sequential releases are included
    const allowedIds = result.allowedReleases.map((r) => r.id);
    expect(allowedIds).toContain(oldestSequentialRelease.id);
    expect(allowedIds).toContain(middleSequentialRelease.id);
    expect(allowedIds).toContain(newestSequentialRelease.id);

    // Should have a reason explaining why
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("Sequential upgrade is required");
  });

  it("should include an intermediate sequential release when targeting the newest sequential release", async () => {
    // Targeting the newest sequential release
    const ctxWithNewestSequentialTarget = {
      ...context,
      desiredReleaseId: newestSequentialRelease.id,
    };

    const candidates = new Releases(allReleases);
    const result = rule.filter(ctxWithNewestSequentialTarget, candidates);

    // Should allow both older sequential releases
    expect(result.allowedReleases.length).toBe(2);

    // Verify older sequential releases are included
    const allowedIds = result.allowedReleases.map((r) => r.id);
    expect(allowedIds).toContain(oldestSequentialRelease.id);
    expect(allowedIds).toContain(middleSequentialRelease.id);

    // Should have a reason explaining why
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("Sequential upgrade is required");
  });

  it("should allow only the oldest sequential release to be applied first", async () => {
    // Start with middle and newest sequential releases
    const limitedCandidates = new Releases([
      middleSequentialRelease,
      newestSequentialRelease,
      nonSequentialRelease,
    ]);

    // Targeting non-sequential release
    const result = rule.filter(context, limitedCandidates);

    // Should only allow the middle sequential release (oldest available)
    expect(result.allowedReleases.length).toBe(1);
    expect(result.allowedReleases.getAll()[0].id).toBe(
      middleSequentialRelease.id,
    );
  });

  it("should properly handle a chain of sequential rules", async () => {
    // Simulate a scenario where the oldest was already applied
    // and now we need to apply the middle one
    const candidatesAfterOldest = new Releases([
      middleSequentialRelease,
      newestSequentialRelease,
      nonSequentialRelease,
    ]);

    // Targeting the newest sequential release
    const ctxWithNewestSequentialTarget = {
      ...context,
      desiredReleaseId: newestSequentialRelease.id,
    };

    const resultAfterOldest = rule.filter(
      ctxWithNewestSequentialTarget,
      candidatesAfterOldest,
    );

    // Should only allow the middle sequential release
    expect(resultAfterOldest.allowedReleases.length).toBe(1);
    expect(resultAfterOldest.allowedReleases.getAll()[0].id).toBe(
      middleSequentialRelease.id,
    );

    // Now simulate applying the middle one and check the final step
    const candidatesAfterMiddle = new Releases([
      newestSequentialRelease,
      nonSequentialRelease,
    ]);

    const resultAfterMiddle = rule.filter(
      ctxWithNewestSequentialTarget,
      candidatesAfterMiddle,
    );

    // Should now allow the newest sequential release since it's the target and has no prerequisites left
    expect(resultAfterMiddle.allowedReleases.length).toBe(2);

    // Should include both remaining releases
    const finalAllowedIds = resultAfterMiddle.allowedReleases.map((r) => r.id);
    expect(finalAllowedIds).toContain(newestSequentialRelease.id);
    expect(finalAllowedIds).toContain(nonSequentialRelease.id);
  });
});
