import { describe, expect, it } from "vitest";

import type {
  Deployment,
  DeploymentResourceContext,
  Environment,
  Release,
  Resource,
} from "../../types";
import type { MaintenanceWindow } from "../maintenance-window-rule.js";
import { MaintenanceWindowRule } from "../maintenance-window-rule.js";

// Create a testable subclass that overrides getCurrentTime
class TestMaintenanceWindowRule extends MaintenanceWindowRule {
  private testNow: Date;

  constructor(maintenanceWindows: MaintenanceWindow[], testNow: Date) {
    super(maintenanceWindows);
    this.testNow = testNow;
  }

  // Override getCurrentTime to return our fixed test date
  protected getCurrentTime(): Date {
    return this.testNow;
  }
}

describe("MaintenanceWindowRule", () => {
  // Mock the current date to make tests deterministic
  const mockNow = new Date("2024-03-23T12:00:00Z");

  // Sample test data
  const mockReleases: Release[] = [
    {
      id: "release-1",
      createdAt: new Date("2024-03-22T10:00:00Z"),
      version: {
        tag: "1.0.0",
        config: "{}",
        metadata: {},
        statusHistory: {},
      },
      variables: {},
    },
    {
      id: "release-2",
      createdAt: new Date("2024-03-23T10:00:00Z"),
      version: {
        tag: "1.1.0",
        config: "{}",
        metadata: {},
        statusHistory: {},
      },
      variables: {},
    },
  ];

  const mockDeployment: Deployment = {
    id: "deployment-1",
    name: "test-deployment",
  };

  const mockResource: Resource = {
    id: "resource-1",
    name: "test-resource",
  };

  const mockEnvironment: Environment = {
    id: "env-1",
    name: "test-environment",
  };

  const mockContext: DeploymentResourceContext = {
    desiredReleaseId: "release-2",
    deployment: mockDeployment,
    resource: mockResource,
    environment: mockEnvironment,
    availableReleases: mockReleases,
  };

  // We won't need beforeEach/afterEach hooks as we'll mock the method directly
  // by creating our own test subclass

  it("should allow all releases when no maintenance windows are configured", () => {
    // Arrange
    const rule = new TestMaintenanceWindowRule([], mockNow);

    // Act
    const result = rule.filter(mockContext, mockReleases);

    // Assert
    expect(result.allowedReleases).toEqual(mockReleases);
    expect(result.reason).toBeUndefined();
  });

  it("should allow all releases when no maintenance windows are active", () => {
    // Arrange
    const pastWindow: MaintenanceWindow = {
      name: "Past Maintenance",
      start: new Date("2024-03-22T10:00:00Z"),
      end: new Date("2024-03-22T12:00:00Z"),
    };

    const futureWindow: MaintenanceWindow = {
      name: "Future Maintenance",
      start: new Date("2024-03-24T10:00:00Z"),
      end: new Date("2024-03-24T12:00:00Z"),
    };

    const rule = new TestMaintenanceWindowRule(
      [pastWindow, futureWindow],
      mockNow,
    );

    // Act
    const result = rule.filter(mockContext, mockReleases);

    // Assert
    expect(result.allowedReleases).toEqual(mockReleases);
    expect(result.reason).toBeUndefined();
  });

  it("should block all releases when a maintenance window is active", () => {
    // Arrange
    const activeWindow: MaintenanceWindow = {
      name: "Active Maintenance",
      start: new Date("2024-03-23T10:00:00Z"),
      end: new Date("2024-03-23T14:00:00Z"),
    };

    const rule = new TestMaintenanceWindowRule([activeWindow], mockNow);

    // Act
    const result = rule.filter(mockContext, mockReleases);

    // Assert
    expect(result.allowedReleases).toEqual([]);
    expect(result.reason).toContain("Active Maintenance");
  });

  it("should block all releases when multiple maintenance windows are active", () => {
    // Arrange
    const activeWindow1: MaintenanceWindow = {
      name: "Database Maintenance",
      start: new Date("2024-03-23T10:00:00Z"),
      end: new Date("2024-03-23T14:00:00Z"),
    };

    const activeWindow2: MaintenanceWindow = {
      name: "Network Maintenance",
      start: new Date("2024-03-23T11:00:00Z"),
      end: new Date("2024-03-23T13:00:00Z"),
    };

    const rule = new TestMaintenanceWindowRule(
      [activeWindow1, activeWindow2],
      mockNow,
    );

    // Act
    const result = rule.filter(mockContext, mockReleases);

    // Assert
    expect(result.allowedReleases).toEqual([]);
    expect(result.reason).toContain("Database Maintenance");
    expect(result.reason).toContain("Network Maintenance");
  });

  it("should handle exact boundary cases correctly (start time)", () => {
    // Arrange - window starts exactly at the current time
    const startingWindow: MaintenanceWindow = {
      name: "Starting Maintenance",
      start: new Date("2024-03-23T12:00:00Z"), // Exactly now
      end: new Date("2024-03-23T14:00:00Z"),
    };

    const rule = new TestMaintenanceWindowRule([startingWindow], mockNow);

    // Act
    const result = rule.filter(mockContext, mockReleases);

    // Assert - should be considered active
    expect(result.allowedReleases).toEqual([]);
    expect(result.reason).toContain("Starting Maintenance");
  });

  it("should handle exact boundary cases correctly (end time)", () => {
    // Arrange - window ends exactly at the current time
    const endingWindow: MaintenanceWindow = {
      name: "Ending Maintenance",
      start: new Date("2024-03-23T10:00:00Z"),
      end: new Date("2024-03-23T12:00:00Z"), // Exactly now
    };

    const rule = new TestMaintenanceWindowRule([endingWindow], mockNow);

    // Act
    const result = rule.filter(mockContext, mockReleases);

    // Assert - should be considered active (inclusive end)
    expect(result.allowedReleases).toEqual([]);
    expect(result.reason).toContain("Ending Maintenance");
  });

  it("should ignore maintenance windows with invalid dates (end before start)", () => {
    // Arrange - window with end before start (invalid)
    const invalidWindow: MaintenanceWindow = {
      name: "Invalid Window",
      start: new Date("2024-03-23T14:00:00Z"),
      end: new Date("2024-03-23T10:00:00Z"), // Before start
    };

    const rule = new TestMaintenanceWindowRule([invalidWindow], mockNow);

    // Act
    const result = rule.filter(mockContext, mockReleases);

    // Assert - should not be considered active
    expect(result.allowedReleases).toEqual(mockReleases);
    expect(result.reason).toBeUndefined();
  });

  it("should handle mixed valid and invalid maintenance windows correctly", () => {
    // Arrange
    const validWindow: MaintenanceWindow = {
      name: "Valid Window",
      start: new Date("2024-03-23T10:00:00Z"),
      end: new Date("2024-03-23T14:00:00Z"),
    };

    const invalidWindow: MaintenanceWindow = {
      name: "Invalid Window",
      start: new Date("2024-03-23T16:00:00Z"),
      end: new Date("2024-03-23T15:00:00Z"), // Before start
    };

    const rule = new TestMaintenanceWindowRule(
      [validWindow, invalidWindow],
      mockNow,
    );

    // Act
    const result = rule.filter(mockContext, mockReleases);

    // Assert - should be blocked by the valid window only
    expect(result.allowedReleases).toEqual([]);
    expect(result.reason).toContain("Valid Window");
    expect(result.reason).not.toContain("Invalid Window");
  });

  it("should not modify the input candidates array", () => {
    // Arrange
    const rule = new TestMaintenanceWindowRule([], mockNow);
    const originalCandidates = [...mockReleases];

    // Act
    rule.filter(mockContext, mockReleases);

    // Assert - original array should not be modified
    expect(mockReleases).toEqual(originalCandidates);
  });
});
