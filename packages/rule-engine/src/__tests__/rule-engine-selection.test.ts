import { describe, expect, it } from "vitest";

import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";
import type { Releases } from "../utils/releases.js";
import { RuleEngine } from "../rule-engine.js";

// Mock rule that passes through all candidates
class PassThroughRule implements DeploymentResourceRule {
  name = "PassThroughRule";

  filter(
    context: DeploymentResourceContext,
    candidates: Releases,
  ): DeploymentResourceRuleResult {
    return { allowedReleases: candidates };
  }
}

// Mock rule that returns all releases with requiresSequentialUpgrade=true
class SequentialFilterRule implements DeploymentResourceRule {
  name = "SequentialFilterRule";

  filter(
    context: DeploymentResourceContext,
    candidates: Releases,
  ): DeploymentResourceRuleResult {
    const sequentialReleases = candidates.filterByMetadata(
      "requiresSequentialUpgrade",
      "true",
    );
    return {
      allowedReleases: sequentialReleases,
      reason: "Filtered to sequential releases only",
    };
  }
}

describe("RuleEngine selection logic", () => {
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

  // Standard context with all releases
  const context: DeploymentResourceContext = {
    desiredReleaseId: nonSequentialRelease.id,
    deployment: { id: "deploy-1", name: "test-deploy" },
    environment: { id: "env-1", name: "test-env" },
    resource: { id: "resource-1", name: "test-resource" },
    availableReleases: allReleases,
  };

  it("should select the oldest sequential release when sequential releases are present", async () => {
    const engine = new RuleEngine([new PassThroughRule()]);

    // Create context with sequential releases
    const result = await engine.evaluate({
      ...context,
      // Desire the newest sequential release, which should be overridden
      desiredReleaseId: newestSequentialRelease.id,
    });

    expect(result.allowed).toBe(true);
    expect(result.chosenRelease?.id).toBe(oldestSequentialRelease.id);
  });

  it("should select the desired release when no sequential releases are present", async () => {
    const engine = new RuleEngine([new PassThroughRule()]);

    // Create context with only non-sequential releases
    const nonSequentialContext = {
      ...context,
      availableReleases: [nonSequentialRelease],
      desiredReleaseId: nonSequentialRelease.id,
    };

    const result = await engine.evaluate(nonSequentialContext);

    expect(result.allowed).toBe(true);
    expect(result.chosenRelease?.id).toBe(nonSequentialRelease.id);
  });

  it("should select the newest release when no sequential or desired releases are specified", async () => {
    const engine = new RuleEngine([new PassThroughRule()]);

    // Create context with no desired release
    const noDesiredContext = {
      ...context,
      desiredReleaseId: undefined as unknown as string,
    };

    const result = await engine.evaluate(noDesiredContext);

    expect(result.allowed).toBe(true);
    expect(result.chosenRelease?.id).toBe(nonSequentialRelease.id); // The newest release
  });

  it("should work with a rule that filters to only sequential releases", async () => {
    const engine = new RuleEngine([new SequentialFilterRule()]);

    const result = await engine.evaluate(context);

    expect(result.allowed).toBe(true);
    expect(result.chosenRelease?.id).toBe(oldestSequentialRelease.id);
  });

  it("should handle empty candidate list", async () => {
    const engine = new RuleEngine([]);

    // Create context with no releases
    const emptyContext = {
      ...context,
      availableReleases: [],
    };

    const result = await engine.evaluate(emptyContext);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });
});
