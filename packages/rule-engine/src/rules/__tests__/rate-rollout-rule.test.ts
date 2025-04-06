import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResolvedRelease } from "../../types.js";
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
  
  // Create a spy on Date constructor
  const dateSpy = vi.spyOn(global, "Date");

  beforeEach(() => {
    // Reset the mock before each test
    vi.resetAllMocks();
    // Mock the Date constructor to return a fixed date
    dateSpy.mockImplementation(() => baseDate);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockReleases = (releaseTimes: number[]): Releases => {
    const releases = releaseTimes.map((minutesAgo, index) => {
      const createdAt = new Date(baseDate.getTime() - minutesAgo * 60 * 1000);
      return {
        id: `release-${index}`,
        createdAt,
        version: {
          id: `version-${index}`,
          tag: `v0.${index}.0`,
          config: {},
          metadata: {},
          createdAt,
        },
        variables: {},
      } as ResolvedRelease;
    });

    return new Releases(releases);
  };

  it("should allow all releases if their rollout period is complete", () => {
    // Create releases that were created a long time ago
    const mockReleases = createMockReleases([1000, 5000, 7000]);
    
    // Create rule with a short 10-minute rollout period
    const rule = new RateRolloutRule({ rolloutDurationSeconds: 600 });
    
    // Override getHashValue to return values that will be included
    vi.spyOn(rule as any, "getHashValue").mockImplementation((id: string) => {
      // Return values that will be <= 100% rollout percentage
      return parseInt(id.split('-')[1]) * 25; // 0, 25, 50
    });
    
    const result = rule.filter(mockDeploymentContext, mockReleases);
    
    // All releases should be allowed since they were created long ago
    expect(result.allowedReleases.getAll().length).toBe(mockReleases.length);
    expect(result.rejectionReasons).toBeUndefined();
  });

  it("should partially roll out releases based on elapsed time", () => {
    // Mock the Date constructor to return a fixed "now" time
    const now = new Date("2025-01-01T01:00:00Z"); // 1 hour from base
    dateSpy.mockImplementation(() => now);
    
    // Create a rule with a 2-hour rollout period
    const rule = new RateRolloutRule({
      rolloutDurationSeconds: 7200, // 2 hours
    });
    
    // Create test release instance with getCurrentTime spy
    const getCurrentTimeSpy = vi.spyOn(rule as any, "getCurrentTime");
    
    // Create releases at different times
    const releases = createMockReleases([
      30,    // 30 minutes ago - 25% through rollout
      60,    // 60 minutes ago - 50% through rollout
      90,    // 90 minutes ago - 75% through rollout
      120,   // 120 minutes ago - 100% through rollout
    ]);
    
    // Mock hash values to make testing deterministic
    vi.spyOn(rule as any, "getHashValue").mockImplementation((id: string) => {
      const idNum = parseInt(id.split('-')[1]);
      // release-0: 30, release-1: 40, release-2: 70, release-3: 90
      return (idNum + 1) * 30 - 10;
    });
    
    const result = rule.filter(mockDeploymentContext, releases);
    
    // Verify getCurrentTime was called
    expect(getCurrentTimeSpy).toHaveBeenCalled();
    
    // release-3 (120 mins ago) should be allowed (100% rollout with hash 90)
    expect(result.allowedReleases.find(r => r.id === "release-3")).toBeDefined();
    
    // release-2 (90 mins ago) should be allowed (75% rollout with hash 70)
    expect(result.allowedReleases.find(r => r.id === "release-2")).toBeDefined();
    
    // release-1 (60 mins ago) should be allowed (50% rollout with hash 40)
    expect(result.allowedReleases.find(r => r.id === "release-1")).toBeDefined();
    
    // release-0 (30 mins ago) should be rejected (25% rollout with hash 30)
    expect(result.allowedReleases.find(r => r.id === "release-0")).toBeUndefined();
    
    // Verify rejection reasons exist for denied releases
    expect(result.rejectionReasons).toBeDefined();
    expect(result.rejectionReasons?.get("release-0")).toBeDefined();
  });

  it("should include remaining time in rejection reason", () => {
    // Mock the Date constructor to return a fixed "now" time
    const now = new Date("2025-01-01T00:30:00Z"); // 30 minutes from base
    dateSpy.mockImplementation(() => now);
    
    // Create a rule with a 2-hour rollout period
    const rule = new RateRolloutRule({
      rolloutDurationSeconds: 7200, // 2 hours
    });
    
    // Create a very recent release (10 minutes ago - only ~8% through rollout)
    const releases = createMockReleases([10]);
    
    // Force the release to be denied by making getHashValue return 100
    vi.spyOn(rule as any, "getHashValue").mockReturnValue(100);
    
    const result = rule.filter(mockDeploymentContext, releases);
    
    // The release should be denied
    expect(result.allowedReleases.length).toBe(0);
    
    // Check that the rejection reason includes the remaining time
    const rejectionReason = result.rejectionReasons?.get("release-0");
    expect(rejectionReason).toBeDefined();
    
    // Should mention the percentage and remaining time
    expect(rejectionReason).toContain("8% complete");
    expect(rejectionReason).toMatch(/eligible in ~1h \d+m/);
  });
});