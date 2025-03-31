# @ctrlplane/release-manager

A streamlined solution for managing context-specific software releases with
variable resolution and version tracking.

## Overview

The release-manager package provides functionality to manage software releases
across different resources and environments. It handles variable resolution from
multiple sources and ensures releases are only created when necessary (when
variables or versions change).

## Key Components

### ReleaseManager

The main entry point for the package. It coordinates variable retrieval and
release creation.

```typescript
const manager = new ReleaseManager({
  deploymentId: "deployment-123",
  environmentId: "production",
  resourceId: "resource-456",
  db: dbTransaction, // Optional transaction object
});

// Create a release for a specific version
const { created, release } = await manager.upsertRelease("v1.0.0");

// Set a release as the desired release
await manager.setDesiredRelease(release.id);
```

### Variable System

Handles the retrieval and resolution of variables from multiple sources with a
clear priority order:

1. **Resource Variables**: Specific to a resource
2. **Deployment Variables**: Associated with deployments, matched to resources
   via selectors
3. **System Variable Sets**: Global variables for environments

```typescript
// Get all variables for the current context
const variables = await manager.getCurrentVariables();
```

### Repository Layer

Manages database interactions for releases with a clean interface:

```typescript
// The ReleaseManager uses these methods internally
const repository = new DatabaseReleaseRepository(db);

// Create a release directly
const release = await repository.create({
  deploymentId: "deployment-123",
  environmentId: "production",
  resourceId: "resource-456",
  versionId: "v1.0.0",
  variables: [...resolvedVariables],
});

// Ensure a release exists (create only if needed)
const { created, release } = await repository.upsert(
  { deploymentId, environmentId, resourceId },
  versionId,
  variables
);
```

## How It Works

1. **Variable Resolution**: When a release is requested, the system fetches
   variables from all available providers (resource, deployment, and system).

2. **Release Creation Logic**: The system checks if a release with the exact
   same version and variables already exists:

   - If it exists, it returns the existing release
   - If not, it creates a new release with the current variables

3. **Version Release Flow**: When a new version is released to a deployment:
   - The system identifies all applicable resources
   - For each resource, it creates a release with the resolved variables
   - Optionally marks the release as the "desired" release for the resource

## Testing

```bash
# Run tests
pnpm test

# Check types
pnpm typecheck
```

## Integration Example

```typescript
import { db } from "@ctrlplane/db/client";
import { ReleaseManager } from "@ctrlplane/release-manager";

// Create a release manager for a specific context
const releaseManager = new ReleaseManager({
  deploymentId: "my-app",
  environmentId: "production",
  resourceId: "web-server-1",
});

// Create or get an existing release for version "2.0.0"
// All variables will be automatically resolved
const { created, release } = await releaseManager.upsertRelease("2.0.0", {
  setAsDesired: true, // Mark as the desired release
});

console.log(`Release ${created ? "created" : "already exists"}: ${release.id}`);
console.log(`Variables resolved: ${release.variables.length}`);
```

## Release New Version Flow

```typescript
import { db } from "@ctrlplane/db/client";
import { releaseNewVersion } from "@ctrlplane/release-manager";

// Create releases for all resources matching a deployment version
await releaseNewVersion(db, "version-123");
```

## License

MIT
