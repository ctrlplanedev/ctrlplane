import { describe, expect, test, vi } from "vitest";
import { InMemoryReleaseStorage, ReleaseManager } from "../src";
import {
  ContextSpecificCondition,
  LogVariableChangeAction,
  VariableChangedCondition,
} from "../src";
import { RuleEngine } from "../src";

// Mock for generateId
const generateId = () => `id-${Math.floor(Math.random() * 1000)}`;

describe("Variable Resolution", () => {
  test("should resolve variables in the correct priority order", async () => {
    // Setup
    const storage = new InMemoryReleaseStorage();
    const releaseManager = new ReleaseManager({ storage, generateId });

    // Setup resources, deployments, environments
    const environment = {
      id: "env-1",
      name: "Production",
      updatedAt: new Date(),
    };

    const resource = {
      id: "res-1",
      name: "API Server",
      labels: {
        type: "backend",
        tier: "api",
      },
      environmentId: "env-1",
      updatedAt: new Date(),
    };

    const deployment = {
      id: "deploy-1",
      name: "Backend Deployment",
      selectors: [
        { key: "type", value: "backend" },
      ],
      updatedAt: new Date(),
    };

    // Setup variables at different levels
    const standardVariable = {
      id: "var-1",
      type: "variable" as const,
      name: "API_URL",
      value: "https://api.example.com",
      updatedAt: new Date(),
    };

    const deploymentVariable = {
      id: "var-2",
      type: "deploymentVariable" as const,
      name: "API_URL",
      value: "https://api.staging.example.com",
      selectors: [
        { key: "type", value: "backend" },
      ],
      deploymentId: "deploy-1",
      updatedAt: new Date(),
    };

    const resourceVariable = {
      id: "var-3",
      type: "resourceVariable" as const,
      name: "API_URL",
      value: "https://api.prod.example.com",
      resourceId: "res-1",
      environmentId: "env-1",
      updatedAt: new Date(),
    };

    // Also create a variable that only exists at standard level
    const standardOnlyVariable = {
      id: "var-4",
      type: "variable" as const,
      name: "LOG_LEVEL",
      value: "info",
      updatedAt: new Date(),
    };

    // Initialize storage
    storage.setEnvironments([environment]);
    storage.setResources([resource]);
    storage.setDeployments([deployment]);
    storage.setVariables([standardVariable, standardOnlyVariable]);
    storage.setDeploymentVariables([deploymentVariable]);
    storage.setResourceVariables([resourceVariable]);

    // Create a context for resolution
    const context = {
      resourceId: "res-1",
      environmentId: "env-1",
      deploymentId: "deploy-1",
    };

    // Test resource variable (highest priority)
    const resolvedApiUrl = await releaseManager.getVariable("API_URL", context);
    expect(resolvedApiUrl).not.toBeNull();
    expect(resolvedApiUrl?.value).toBe("https://api.prod.example.com");
    expect(resolvedApiUrl?.type).toBe("resourceVariable");

    // Test standard variable (fallback when no higher priority exists)
    const resolvedLogLevel = await releaseManager.getVariable("LOG_LEVEL", context);
    expect(resolvedLogLevel).not.toBeNull();
    expect(resolvedLogLevel?.value).toBe("info");
    expect(resolvedLogLevel?.type).toBe("variable");

    // Test all variables for the context
    const allVariables = await releaseManager.getVariablesForContext(context);
    expect(allVariables.length).toBe(2); // API_URL and LOG_LEVEL
    
    // Verify we get the highest priority for each name
    const apiUrlVar = allVariables.find(v => v.name === "API_URL");
    expect(apiUrlVar).not.toBeNull();
    expect(apiUrlVar?.type).toBe("resourceVariable");
    expect(apiUrlVar?.value).toBe("https://api.prod.example.com");
    
    const logLevelVar = allVariables.find(v => v.name === "LOG_LEVEL");
    expect(logLevelVar).not.toBeNull();
    expect(logLevelVar?.type).toBe("variable");
    expect(logLevelVar?.value).toBe("info");

    // Test with a context that has no resource variable
    const newContext = {
      resourceId: "res-2", // Different resource
      environmentId: "env-1",
      deploymentId: "deploy-1",
    };

    // Should fall back to deployment variable
    const fallbackApiUrl = await releaseManager.getVariable("API_URL", newContext);
    expect(fallbackApiUrl).toBeNull(); // Since res-2 doesn't exist, and resource labels can't be checked

    // Create a resource with matching labels for deployment variable
    const newResource = {
      id: "res-2",
      name: "Secondary API",
      labels: {
        type: "backend", // Matches the deployment selector
        tier: "secondary",
      },
      environmentId: "env-1",
      updatedAt: new Date(),
    };
    
    storage.setResources([...storage.getResources(), newResource]);
    
    // Now should resolve to deployment variable
    const deploymentApiUrl = await releaseManager.getVariable("API_URL", {
      ...newContext,
      resource: newResource,
    });
    
    expect(deploymentApiUrl).not.toBeNull();
    expect(deploymentApiUrl?.type).toBe("deploymentVariable");
    expect(deploymentApiUrl?.value).toBe("https://api.staging.example.com");
  });

  test("should create releases with context-specific variables", async () => {
    // Setup
    const storage = new InMemoryReleaseStorage();
    const releaseManager = new ReleaseManager({ storage, generateId });

    // Setup resource and variables
    const resource = {
      id: "res-1",
      name: "API Server",
      labels: {
        type: "backend",
      },
      environmentId: "env-1",
      updatedAt: new Date(),
    };

    const resourceVariable = {
      id: "var-1",
      type: "resourceVariable" as const,
      name: "API_URL",
      value: "https://api.prod.example.com",
      resourceId: "res-1",
      environmentId: "env-1",
      updatedAt: new Date(),
    };

    // Initialize storage
    storage.setResources([resource]);
    storage.setResourceVariables([resourceVariable]);

    // Create a release for the variable in a specific context
    const context = {
      resourceId: "res-1",
      environmentId: "env-1",
      resource: resource,
    };

    const release = await releaseManager.createReleaseForVariable("API_URL", context);

    // Check release metadata
    expect(release).not.toBeNull();
    expect(release?.triggerType).toBe("variable");
    expect(release?.triggerId).toBe("API_URL");
    expect(release?.resourceId).toBe("res-1");
    expect(release?.environmentId).toBe("env-1");
    expect(release?.metadata?.variableType).toBe("resourceVariable");
    expect(release?.metadata?.variableName).toBe("API_URL");
    expect(release?.metadata?.variableValue).toBe("https://api.prod.example.com");

    // Update the variable value
    const updatedVariable = {
      ...resourceVariable,
      value: "https://api.v2.prod.example.com",
      updatedAt: new Date(Date.now() + 1000), // Ensure it's newer
    };
    
    storage.setResourceVariables([updatedVariable]);
    
    // Create another release - should be a new one due to the value change
    const newRelease = await releaseManager.createReleaseForVariable("API_URL", context);
    
    expect(newRelease).not.toBeNull();
    expect(newRelease?.id).not.toBe(release?.id);
    expect(newRelease?.metadata?.variableValue).toBe("https://api.v2.prod.example.com");
    
    // Get releases for this context
    const contextReleases = await releaseManager.getReleases(context);
    expect(contextReleases.length).toBe(2);
    
    // Should be sorted by date (newest first)
    expect(contextReleases[0].id).toBe(newRelease?.id);
  });

  test("should process releases with context-specific rules", async () => {
    // Setup
    const storage = new InMemoryReleaseStorage();
    const releaseManager = new ReleaseManager({ storage, generateId });

    // Setup resources and variables
    const prodEnv = {
      id: "env-prod",
      name: "Production",
      updatedAt: new Date(),
    };
    
    const stagingEnv = {
      id: "env-staging",
      name: "Staging",
      updatedAt: new Date(),
    };

    const prodResource = {
      id: "res-prod",
      name: "Production API",
      labels: { environment: "production" },
      environmentId: "env-prod",
      updatedAt: new Date(),
    };
    
    const stagingResource = {
      id: "res-staging",
      name: "Staging API",
      labels: { environment: "staging" },
      environmentId: "env-staging",
      updatedAt: new Date(),
    };

    const prodVariable = {
      id: "var-prod",
      type: "resourceVariable" as const,
      name: "FEATURE_FLAG",
      value: true,
      resourceId: "res-prod",
      environmentId: "env-prod",
      updatedAt: new Date(),
    };
    
    const stagingVariable = {
      id: "var-staging",
      type: "resourceVariable" as const,
      name: "FEATURE_FLAG",
      value: true,
      resourceId: "res-staging",
      environmentId: "env-staging",
      updatedAt: new Date(),
    };

    // Initialize storage
    storage.setEnvironments([prodEnv, stagingEnv]);
    storage.setResources([prodResource, stagingResource]);
    storage.setResourceVariables([prodVariable, stagingVariable]);

    // Setup rule engine with context-specific conditions
    const prodLogSpy = vi.fn();
    const stagingLogSpy = vi.fn();
    
    // Production-specific rule
    const prodRule = {
      id: "rule-prod",
      name: "Production Feature Flag Rule",
      condition: new ContextSpecificCondition("res-prod", "env-prod"),
      action: {
        execute: async () => {
          prodLogSpy();
          console.log("Production feature flag enabled");
        },
      },
    };
    
    // Staging-specific rule
    const stagingRule = {
      id: "rule-staging",
      name: "Staging Feature Flag Rule",
      condition: new ContextSpecificCondition("res-staging", "env-staging"),
      action: {
        execute: async () => {
          stagingLogSpy();
          console.log("Staging feature flag enabled");
        },
      },
    };
    
    const ruleEngine = new RuleEngine({
      rules: [prodRule, stagingRule],
    });

    // Create releases for both environments
    const prodContext = {
      resourceId: "res-prod",
      environmentId: "env-prod",
      resource: prodResource,
      environment: prodEnv,
    };
    
    const stagingContext = {
      resourceId: "res-staging",
      environmentId: "env-staging",
      resource: stagingResource,
      environment: stagingEnv,
    };
    
    const prodRelease = await releaseManager.createReleaseForVariable("FEATURE_FLAG", prodContext);
    const stagingRelease = await releaseManager.createReleaseForVariable("FEATURE_FLAG", stagingContext);
    
    expect(prodRelease).not.toBeNull();
    expect(stagingRelease).not.toBeNull();
    
    // Process the production release
    await ruleEngine.processRelease(prodRelease!, prodVariable, undefined, prodContext);
    
    // Only the production rule should have been executed
    expect(prodLogSpy).toHaveBeenCalledTimes(1);
    expect(stagingLogSpy).not.toHaveBeenCalled();
    
    // Reset mocks
    vi.resetAllMocks();
    
    // Process the staging release
    await ruleEngine.processRelease(stagingRelease!, stagingVariable, undefined, stagingContext);
    
    // Only the staging rule should have been executed
    expect(stagingLogSpy).toHaveBeenCalledTimes(1);
    expect(prodLogSpy).not.toHaveBeenCalled();
  });
});