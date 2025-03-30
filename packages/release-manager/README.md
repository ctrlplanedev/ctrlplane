# @ctrlplane/release-manager

A flexible and extensible framework for managing releases triggered by variable changes or version updates, with support for context-specific releases and variable resolution hierarchy.

## Features

- **Idempotent Release Creation**: Creates releases only when variables or versions actually change
- **Context-Specific Releases**: Create releases for specific resources, environments, and deployments
- **Variable Resolution Hierarchy**: Resolve variables with a priority order: resource variables > deployment variables > standard variables
- **Selector-Based Matching**: Use selectors to match deployments to resources
- **Flexible Storage**: Abstract storage interface with ready implementations for both in-memory (testing) and database storage
- **Rule Engine**: Process releases through customizable rules with conditions and actions
- **Strongly Typed**: Full TypeScript support with Zod validation schemas
- **Testable**: Built with testing in mind

## Installation

```bash
# From within the monorepo
pnpm add @ctrlplane/release-manager@workspace:*
```

## Usage

### Variable Types and Resolution Hierarchy

The framework supports three types of variables with a priority hierarchy:

1. **Resource Variables** (highest priority): Specific to a resource and optionally an environment
2. **Deployment Variables** (medium priority): Associated with a deployment and matched to resources via selectors
3. **Standard Variables** (lowest priority): Global variables with no specific context

When resolving a variable value, the framework checks each level in order and returns the highest priority value available.

### Creating Context-Specific Releases

```typescript
import { randomUUID } from "crypto";

import {
  InMemoryReleaseStorage,
  ReleaseManager,
} from "@ctrlplane/release-manager";

// Setup storage and release manager
const storage = new InMemoryReleaseStorage();
const releaseManager = new ReleaseManager({
  storage,
  generateId: () => randomUUID(),
});

// Set up a resource
const resource = {
  id: "app-server-1",
  name: "Application Server",
  labels: { type: "app", tier: "backend" },
  environmentId: "production",
};

// Set resource in storage
storage.setResources([resource]);

// Create a resource-specific variable
const resourceVariable = {
  id: "var-1",
  type: "resourceVariable",
  name: "API_URL",
  value: "https://api.prod.example.com",
  resourceId: "app-server-1",
  environmentId: "production",
  updatedAt: new Date(),
};

// Store the variable
storage.setResourceVariables([resourceVariable]);

// Create a context for the release
const context = {
  resourceId: "app-server-1",
  environmentId: "production",
  resource: resource,
};

// Create a release for the variable in this specific context
const release = await releaseManager.createReleaseForVariable(
  "API_URL",
  context,
);
console.log(`Release created: ${release.id}`);
```

### Working with Variable Resolution

```typescript
// Set up various variable types
storage.setVariables([
  {
    id: "var-global",
    type: "variable",
    name: "DEBUG",
    value: false,
  },
]);

storage.setDeploymentVariables([
  {
    id: "var-deploy",
    type: "deploymentVariable",
    name: "DEBUG",
    value: true,
    deploymentId: "backend-deploy",
    selectors: [{ key: "type", value: "app" }],
  },
]);

// Resolve a variable in a specific context
const debugValue = await releaseManager.getVariable("DEBUG", context);
console.log(`Debug value: ${debugValue.value}`); // true (from deployment variable)

// Get all resolved variables for a context
const allVars = await releaseManager.getVariablesForContext(context);
console.log(`Total variables: ${allVars.length}`);
```

### Creating Version Releases in Context

```typescript
// Create a version
const version = {
  id: "app-version",
  version: "2.0.0",
  updatedAt: new Date(),
};

// Store the version
storage.setVersions([version]);

// Create a release for the version change in a specific context
const versionRelease = await releaseManager.createReleaseForVersion(
  version,
  context,
);
console.log(`Version release created: ${versionRelease.id}`);
```

### Context-Specific Rules

```typescript
import {
  ContextSpecificCondition,
  RuleEngine,
  SemverCondition,
  TriggerDeploymentAction,
  VersionChangedCondition,
} from "@ctrlplane/release-manager";

// Create a deployment service (mock)
const deploymentService = {
  triggerDeployment: async (props) => {
    console.log(
      `Deploying ${props.version} to ${props.resourceId} in ${props.environmentId}`,
    );
  },
};

// Create environment-specific rules
const ruleEngine = new RuleEngine({
  rules: [
    {
      id: "prod-deploy-rule",
      name: "Production Deployment Rule",
      // Only trigger for production environment and major version changes
      condition: {
        async evaluate(props) {
          const isProd = new ContextSpecificCondition(
            undefined,
            "production",
          ).evaluate(props);

          const isMajorVersion = new SemverCondition("^2.0.0").evaluate(props);

          return (await isProd) && (await isMajorVersion);
        },
      },
      action: new TriggerDeploymentAction(deploymentService),
    },
  ],
});

// Process the version release through rules
await ruleEngine.processRelease(versionRelease, undefined, version, context);
```

### Database Integration

```typescript
import { DatabaseReleaseStorage } from "@ctrlplane/release-manager";

// Assuming you have a database client from @ctrlplane/db
const dbClient = createDbClient();

// Create a database-backed storage
const dbStorage = new DatabaseReleaseStorage(dbClient);

// Use the storage with release manager
const releaseManager = new ReleaseManager({
  storage: dbStorage,
  generateId: () => randomUUID(),
});
```

## Testing

```bash
# Run the test suite
pnpm test
```

## License

MIT
