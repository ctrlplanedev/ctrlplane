import { describe, expect, test, vi } from "vitest";
import { InMemoryReleaseStorage, ReleaseManager } from "../src";
import {
  LogVariableChangeAction,
  LogVersionChangeAction,
  VariableChangedCondition,
  VersionChangedCondition,
} from "../src";
import { RuleEngine } from "../src";

// Mock for generateId
const generateId = () => `id-${Math.floor(Math.random() * 1000)}`;

describe("ReleaseManager", () => {
  test("should create a release for a variable change", async () => {
    // Setup
    const storage = new InMemoryReleaseStorage();
    const releaseManager = new ReleaseManager({ storage, generateId });

    // Create a variable and release
    const variable = {
      id: "var-1",
      name: "test-variable",
      value: "test-value",
      updatedAt: new Date(),
    };

    // Set the variables in storage
    storage.setVariables([variable]);

    // Create a release
    const release = await releaseManager.createReleaseForVariable(variable);

    // Assertions
    expect(release).not.toBeNull();
    expect(release?.triggerType).toBe("variable");
    expect(release?.triggerId).toBe(variable.id);

    // Verify idempotency - creating again should return the same release
    const sameRelease = await releaseManager.createReleaseForVariable(variable);
    expect(sameRelease?.id).toBe(release?.id);
  });

  test("should create a release for a version change", async () => {
    // Setup
    const storage = new InMemoryReleaseStorage();
    const releaseManager = new ReleaseManager({ storage, generateId });

    // Create a version and release
    const version = {
      id: "ver-1",
      version: "1.0.0",
      updatedAt: new Date(),
    };

    // Set the versions in storage
    storage.setVersions([version]);

    // Create a release
    const release = await releaseManager.createReleaseForVersion(version);

    // Assertions
    expect(release).not.toBeNull();
    expect(release?.triggerType).toBe("version");
    expect(release?.triggerId).toBe(version.id);

    // Verify idempotency - creating again should return the same release
    const sameRelease = await releaseManager.createReleaseForVersion(version);
    expect(sameRelease?.id).toBe(release?.id);
  });
});

describe("RuleEngine", () => {
  test("should process release through rules", async () => {
    // Setup
    const storage = new InMemoryReleaseStorage();
    const releaseManager = new ReleaseManager({ storage, generateId });

    // Create a version and release
    const version = {
      id: "ver-1",
      version: "2.0.0",
      updatedAt: new Date(),
    };

    // Set up version in storage
    storage.setVersions([version]);

    // Create a mock action for testing
    const mockAction = { execute: vi.fn() };

    // Create a rule engine
    const ruleEngine = new RuleEngine({
      rules: [
        {
          id: "rule-1",
          name: "Test Version Rule",
          condition: new VersionChangedCondition(),
          action: mockAction,
        },
      ],
    });

    // Create a release
    const release = await releaseManager.createReleaseForVersion(version);
    if (!release) throw new Error("Failed to create release");

    // Process the release
    await ruleEngine.processRelease(release, undefined, version);

    // Assertions
    expect(mockAction.execute).toHaveBeenCalledTimes(1);
    expect(mockAction.execute).toHaveBeenCalledWith({
      release,
      version,
      context: {},
    });
  });

  test("should only execute actions for matching conditions", async () => {
    // Setup
    const storage = new InMemoryReleaseStorage();
    const releaseManager = new ReleaseManager({ storage, generateId });

    // Create a variable
    const variable = {
      id: "var-1",
      name: "test-variable",
      value: "test-value",
      updatedAt: new Date(),
    };

    // Set the variable in storage
    storage.setVariables([variable]);

    // Create mock actions for testing
    const mockVariableAction = { execute: vi.fn() };
    const mockVersionAction = { execute: vi.fn() };

    // Create a rule engine with both rules
    const ruleEngine = new RuleEngine({
      rules: [
        {
          id: "rule-1",
          name: "Variable Rule",
          condition: new VariableChangedCondition(),
          action: mockVariableAction,
        },
        {
          id: "rule-2",
          name: "Version Rule",
          condition: new VersionChangedCondition(),
          action: mockVersionAction,
        },
      ],
    });

    // Create a variable release
    const release = await releaseManager.createReleaseForVariable(variable);
    if (!release) throw new Error("Failed to create release");

    // Process the release
    await ruleEngine.processRelease(release, variable);

    // Assertions - only the variable action should have been called
    expect(mockVariableAction.execute).toHaveBeenCalledTimes(1);
    expect(mockVersionAction.execute).not.toHaveBeenCalled();
  });
});

describe("Integration test", () => {
  test("should implement a complete release workflow", async () => {
    // Setup storage
    const storage = new InMemoryReleaseStorage();
    
    // Setup release manager
    const releaseManager = new ReleaseManager({ storage, generateId });
    
    // Set up variables and versions
    const variable = {
      id: "config-1",
      name: "API_URL",
      value: "https://api.example.com",
      updatedAt: new Date(),
    };
    
    const version = {
      id: "app-version",
      version: "1.2.0",
      updatedAt: new Date(),
    };
    
    // Initialize storage
    storage.setVariables([variable]);
    storage.setVersions([version]);
    
    // Create action spies
    const variableLogSpy = vi.spyOn(console, "log");
    const versionLogSpy = vi.spyOn(console, "log");
    
    // Setup rule engine
    const ruleEngine = new RuleEngine({
      rules: [
        {
          id: "variable-log-rule",
          name: "Log Variable Changes",
          condition: new VariableChangedCondition(),
          action: new LogVariableChangeAction(),
        },
        {
          id: "version-log-rule",
          name: "Log Version Changes",
          condition: new VersionChangedCondition(),
          action: new LogVersionChangeAction(),
        },
      ],
    });
    
    // Create variable release
    const varRelease = await releaseManager.createReleaseForVariable(variable);
    expect(varRelease).not.toBeNull();
    
    // Process variable release through rules
    await ruleEngine.processRelease(varRelease!, variable);
    expect(variableLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Variable changed: API_URL")
    );
    
    // Create version release
    const verRelease = await releaseManager.createReleaseForVersion(version);
    expect(verRelease).not.toBeNull();
    
    // Process version release through rules
    await ruleEngine.processRelease(verRelease!, undefined, version);
    expect(versionLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Version changed: app-version = 1.2.0")
    );
    
    // Verify releases were saved in storage
    const allReleases = await releaseManager.getReleases();
    expect(allReleases.length).toBe(2);
  });
});
