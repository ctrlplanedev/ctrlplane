import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DeploymentResourceContext,
  Policy,
  ResolvedRelease,
} from "../../types.js";
import { Releases } from "../../releases.js";
import {
  DeploymentVersionSelectorRule,
  getApplicableVersionIds,
} from "../deployment-version-selector-rule.js";

describe("DeploymentVersionSelectorRule", () => {
  let releases: Releases;
  let context: DeploymentResourceContext;

  beforeEach(() => {
    // Create a sample set of releases
    const sampleReleases: ResolvedRelease[] = [
      {
        id: "rel-1",
        createdAt: new Date("2023-01-01T12:00:00Z"),
        version: {
          id: "ver-1",
          tag: "v1.0.0",
          config: {},
          metadata: { environment: "prod" },
        },
        variables: {},
      },
      {
        id: "rel-2",
        createdAt: new Date("2023-01-02T12:00:00Z"),
        version: {
          id: "ver-2",
          tag: "v1.1.0-beta",
          config: {},
          metadata: { environment: "staging" },
        },
        variables: {},
      },
    ];

    releases = new Releases(sampleReleases);

    // Create a sample context
    context = {
      desiredReleaseId: null,
      deployment: {
        id: "deploy-1",
        name: "Test Deployment",
      },
      environment: {
        id: "env-1",
        name: "Test Environment",
      },
      resource: {
        id: "res-1",
        name: "Test Resource",
      },
    };
  });

  it("should allow all releases when no version selector is provided", async () => {
    // Create a mock getApplicableVersionIds function that returns all versions when no selector
    const mockGetApplicableVersionIds = vi
      .fn()
      .mockImplementation((_, versionIds) => versionIds);

    const rule = new DeploymentVersionSelectorRule(mockGetApplicableVersionIds);
    const result = await rule.filter(context, releases);

    // Expect all releases to be allowed
    expect(result.allowedReleases.length).toBe(2);
    expect(result.rejectionReasons).toBeDefined();
    expect(result.rejectionReasons?.size).toBe(0);
    expect(mockGetApplicableVersionIds).toHaveBeenCalledWith(context, [
      "ver-1",
      "ver-2",
    ]);
  });

  it("should filter releases based on version selector", async () => {
    // Mock getApplicableVersionIds to only return the first version ID
    const mockGetApplicableVersionIds = vi
      .fn()
      .mockImplementation((_, versionIds) => [versionIds[0]]);

    const rule = new DeploymentVersionSelectorRule(mockGetApplicableVersionIds);
    const result = await rule.filter(context, releases);

    // Expect only the first release to be allowed
    expect(result.allowedReleases.length).toBe(1);
    expect(result.allowedReleases.at(0)?.id).toBe("rel-1");
    expect(result.rejectionReasons).toBeDefined();
    expect(result.rejectionReasons?.get("rel-2")).toBe(
      "Version not in version selector",
    );
  });

  it("should handle async getApplicableVersionIds", async () => {
    // Mock getApplicableVersionIds to asynchronously return only the second version ID
    const mockGetApplicableVersionIds = vi
      .fn()
      .mockImplementation(async (_, versionIds) =>
        Promise.resolve([versionIds[1]]),
      );

    const rule = new DeploymentVersionSelectorRule(mockGetApplicableVersionIds);
    const result = await rule.filter(context, releases);

    // Expect only the second release to be allowed
    expect(result.allowedReleases.length).toBe(1);
    expect(result.allowedReleases.at(0)?.id).toBe("rel-2");
    expect(result.rejectionReasons).toBeDefined();
    expect(result.rejectionReasons?.get("rel-1")).toBe(
      "Version not in version selector",
    );
  });

  describe("getApplicableVersionIds function", () => {
    it("should handle null selector by returning all version IDs", () => {
      const func = getApplicableVersionIds(
        null as unknown as Policy["deploymentVersionSelector"],
      );
      const result = func(context, ["ver-1", "ver-2"]);

      expect(result).toEqual(["ver-1", "ver-2"]);
    });
  });
});
