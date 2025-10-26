# Resource Event Handlers

This package contains event handlers for resource-related operations in the workspace engine.

## Event Types

### Individual Resource Operations

- **`resource.created`** - Handled by `HandleResourceCreated`
  - Creates or updates a single resource
  - Payload: Resource object

- **`resource.updated`** - Handled by `HandleResourceUpdated`
  - Updates a single resource
  - Payload: Resource object

- **`resource.deleted`** - Handled by `HandleResourceDeleted`
  - Deletes a single resource
  - Payload: Resource object

### Resource Provider Operations

- **`resource-provider.created`** - Handled by `HandleResourceProviderCreated`
  - Creates a new resource provider
  - Payload: ResourceProvider object

- **`resource-provider.updated`** - Handled by `HandleResourceProviderUpdated`
  - Updates an existing resource provider
  - Payload: ResourceProvider object

- **`resource-provider.deleted`** - Handled by `HandleResourceProviderDeleted`
  - Deletes a resource provider and nulls the providerId on all its resources
  - Payload: ResourceProvider object

- **`resource-provider.set-resources`** - Handled by `HandleResourceProviderSetResources`
  - Atomically replaces all resources for a given provider
  - Payload: `{ "providerId": string, "resources": Resource[] }`

## Resource Provider Set Resources

The `resource-provider.set-resources` event is particularly useful for providers that sync their entire state periodically. Instead of sending individual create/update/delete events, the provider can send the complete list of resources it manages.

### How It Works

1. Identifies all existing resources belonging to the specified provider
2. Deletes resources that belong to this provider but are not in the new set
3. For each resource in the new set:
   - If a resource with the same **identifier** already exists:
     - If it belongs to **another provider**, it is **skipped** (providers cannot steal resources)
     - If it has **no provider** (null), it is **claimed** by this provider
     - If it **already belongs to this provider**, it is **updated**
   - If no resource with that identifier exists, it is **created**
4. Automatically sets the `providerId` field on all claimed/created resources
5. Triggers recomputation of environments, deployments, and release targets

**Important:** Resources are matched by **identifier**, not by ID. This allows providers to claim unowned resources or update their own resources.

### Event Payload

```json
{
  "eventType": "resource-provider.set-resources",
  "workspaceId": "workspace-123",
  "timestamp": 1234567890,
  "data": {
    "providerId": "my-provider-id",
    "resources": [
      {
        "id": "resource-1",
        "identifier": "my-resource-1",
        "name": "Resource 1",
        "kind": "KubernetesCluster",
        "config": {},
        "metadata": {}
      }
    ]
  }
}
```

### Use Cases

1. **Full Provider Sync** - When a provider syncs its entire state from an external system
2. **Periodic Reconciliation** - Regular sync to ensure workspace state matches reality
3. **Namespace-scoped Management** - A provider managing resources in a specific scope

### Example

```go
// Provider syncs all its resources
resources := fetchAllResourcesFromExternalSystem()

event := Event{
    EventType:   "resource-provider.set-resources",
    WorkspaceID: workspaceID,
    Timestamp:   time.Now().Unix(),
    Data: map[string]interface{}{
        "providerId": "my-provider",
        "resources":  resources,
    },
}
```

### Advantages

- **Atomic operation** - All resources updated in a single transaction
- **Simpler provider logic** - No need to track individual changes
- **Automatic cleanup** - Stale resources are automatically removed
- **Consistency guarantee** - Workspace state exactly matches provider's view
- **Provider isolation** - Providers cannot accidentally steal resources from each other
- **Resource claiming** - Providers can claim unowned resources by identifier

### Resource Ownership Rules

1. **Providers cannot steal resources** - If a resource identifier is already claimed by another provider, the SET operation will skip that resource and log a warning
2. **Providers can claim unowned resources** - If a resource exists but has no provider (providerId is null), any provider can claim it
3. **Providers can update their own resources** - Resources already belonging to the provider are updated with the new data
4. **Matching by identifier** - Resources are matched by their `identifier` field, not their `id` field, allowing for flexible resource management
