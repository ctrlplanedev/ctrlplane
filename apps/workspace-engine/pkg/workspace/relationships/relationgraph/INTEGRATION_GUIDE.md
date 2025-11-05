# Integration Guide: Using Lazy Relationship Graph with Store Layer

## Breaking Circular Dependencies

The relationship graph uses **dependency inversion** via the `EntityProvider` interface to avoid circular dependencies between packages.

### The Pattern

```
relationgraph package:
  - Defines EntityProvider interface
  - Graph depends on EntityProvider (interface)

store package:
  - Implements EntityProvider interface
  - Uses relationgraph.Graph

✅ No circular dependency!
```

## Store Layer Implementation

### Step 1: Implement EntityProvider Interface

In `store/store.go`, make Store implement the `EntityProvider` interface:

```go
package store

import "workspace-engine/pkg/workspace/relationships/relationgraph"

// Implement EntityProvider interface
func (s *Store) GetResources() map[string]*oapi.Resource {
    return s.repo.Resources.Items()
}

func (s *Store) GetDeployments() map[string]*oapi.Deployment {
    return s.repo.Deployments.Items()
}

func (s *Store) GetEnvironments() map[string]*oapi.Environment {
    return s.repo.Environments.Items()
}

func (s *Store) GetRelationshipRules() map[string]*oapi.RelationshipRule {
    return s.repo.RelationshipRules.Items()
}

func (s *Store) GetRelationshipRule(reference string) (*oapi.RelationshipRule, bool) {
    return s.repo.RelationshipRules.Get(reference)
}
```

### Step 2: Initialize Graph in Store

In `store/relationships.go`:

```go
package store

import (
    "workspace-engine/pkg/workspace/relationships/relationgraph"
)

type RelationshipRules struct {
    repo  *repository.InMemoryStore
    store *Store
    graph *relationgraph.Graph  // ✅ No circular dependency!
}

func NewRelationshipRules(store *Store) *RelationshipRules {
    // Store implements EntityProvider, so we can pass it directly
    graph := relationgraph.NewGraph(store)

    return &RelationshipRules{
        repo:  store.repo,
        store: store,
        graph: graph,
    }
}
```

### Step 3: Use Graph for Queries

```go
func (r *RelationshipRules) GetRelatedEntities(
    ctx context.Context,
    entity *oapi.RelatableEntity,
) (map[string][]*oapi.EntityRelation, error) {
    // Lazy loading happens here!
    return r.graph.GetRelatedEntitiesWithCompute(ctx, entity.GetID())
}
```

### Step 4: Add Invalidation to Entity Stores

When entities are updated/deleted, invalidate the cache:

#### In `store/resources.go`:

```go
func (r *Resources) Upsert(ctx context.Context, resource *oapi.Resource) error {
    // Save the entity
    r.repo.Resources.Set(resource.Id, resource)

    // Record change
    if cs, ok := changeset.FromContext[any](ctx); ok {
        cs.Record(changeset.ChangeTypeUpsert, resource)
    }
    r.store.changeset.RecordUpsert(resource)

    // Invalidate relationships
    r.store.Relationships.graph.InvalidateEntity(resource.Id)

    return nil
}

func (r *Resources) Remove(ctx context.Context, id string) error {
    resource, ok := r.repo.Resources.Get(id)
    if !ok {
        return nil
    }

    // Remove the entity
    r.repo.Resources.Remove(id)

    // Record change
    if cs, ok := changeset.FromContext[any](ctx); ok {
        cs.Record(changeset.ChangeTypeDelete, resource)
    }
    r.store.changeset.RecordDelete(resource)

    // Invalidate relationships
    r.store.Relationships.graph.InvalidateEntity(id)

    return nil
}
```

#### In `store/deployments.go`:

```go
func (d *Deployments) Upsert(ctx context.Context, deployment *oapi.Deployment) error {
    d.repo.Deployments.Set(deployment.Id, deployment)

    // ... changeset recording ...

    // Invalidate relationships
    d.store.Relationships.graph.InvalidateEntity(deployment.Id)

    return nil
}

func (d *Deployments) Remove(ctx context.Context, id string) error {
    // ... remove entity ...

    // Invalidate relationships
    d.store.Relationships.graph.InvalidateEntity(id)

    return nil
}
```

#### In `store/environments.go`:

```go
func (e *Environments) Upsert(ctx context.Context, environment *oapi.Environment) error {
    e.repo.Environments.Set(environment.Id, environment)

    // ... changeset recording ...

    // Invalidate relationships
    e.store.Relationships.graph.InvalidateEntity(environment.Id)

    return nil
}

func (e *Environments) Remove(ctx context.Context, id string) error {
    // ... remove entity ...

    // Invalidate relationships
    e.store.Relationships.graph.InvalidateEntity(id)

    return nil
}
```

### Step 5: Add Invalidation to Relationship Rules

When rules are added/updated/removed, invalidate them:

#### In `store/relationships.go`:

```go
func (r *RelationshipRules) Upsert(ctx context.Context, relationship *oapi.RelationshipRule) error {
    // Save the rule
    r.repo.RelationshipRules.Set(relationship.Id, relationship)

    // Record change
    if cs, ok := changeset.FromContext[any](ctx); ok {
        cs.Record(changeset.ChangeTypeUpsert, relationship)
    }
    r.store.changeset.RecordUpsert(relationship)

    // Invalidate rule in graph (mark as dirty)
    r.graph.InvalidateRule(relationship.Reference)

    return nil
}

func (r *RelationshipRules) Remove(ctx context.Context, id string) error {
    relationship, ok := r.repo.RelationshipRules.Get(id)
    if !ok || relationship == nil {
        return nil
    }

    // Remove the rule
    r.repo.RelationshipRules.Remove(id)

    // Record change
    if cs, ok := changeset.FromContext[any](ctx); ok {
        cs.Record(changeset.ChangeTypeDelete, relationship)
    }
    r.store.changeset.RecordDelete(relationship)

    // Invalidate rule in graph
    r.graph.InvalidateRule(relationship.Reference)

    return nil
}
```

## Data Flow After Integration

### Entity Update Flow

```
User updates resource "r1"
    ↓
store.Resources.Upsert(ctx, resource)
    ↓
Save to repository
    ↓
graph.InvalidateEntity("r1")
    ↓
Cache cleared for r1 (and entities that reference it)
    ↓
Next query recomputes with fresh data
```

### Rule Update Flow

```
User updates rule "my-rule"
    ↓
store.Relationships.Upsert(ctx, rule)
    ↓
Save to repository
    ↓
graph.InvalidateRule("my-rule")
    ↓
All relationships using my-rule are cleared
    ↓
Next query recomputes with new rule
```

### Query Flow

```
User queries relationships for "r1"
    ↓
store.Relationships.GetRelatedEntities(ctx, entity)
    ↓
graph.GetRelatedEntitiesWithCompute(ctx, "r1")
    ↓
Check cache: Is r1 computed? Any dirty rules?
    ↓
If needed: graph.ComputeForEntity(ctx, "r1")
    ↓
EntityStore reads from Store (via EntityProvider)
    ↓
Compute relationships and cache
    ↓
Return cached results
```

## Complete Example

Here's how it all fits together:

```go
// In store/store.go
type Store struct {
    // ... existing fields ...
    Relationships *RelationshipRules
}

// Implement EntityProvider
func (s *Store) GetResources() map[string]*oapi.Resource {
    return s.repo.Resources.Items()
}
// ... other EntityProvider methods ...

// In store/relationships.go
func NewRelationshipRules(store *Store) *RelationshipRules {
    graph := relationgraph.NewGraph(store) // Store implements EntityProvider

    return &RelationshipRules{
        repo:  store.repo,
        store: store,
        graph: graph,
    }
}

func (r *RelationshipRules) GetRelatedEntities(ctx context.Context, entity *oapi.RelatableEntity) (map[string][]*oapi.EntityRelation, error) {
    return r.graph.GetRelatedEntitiesWithCompute(ctx, entity.GetID())
}

// In store/resources.go
func (r *Resources) Upsert(ctx context.Context, resource *oapi.Resource) error {
    r.repo.Resources.Set(resource.Id, resource)
    r.store.Relationships.graph.InvalidateEntity(resource.Id)
    return nil
}
```

## Key Benefits

1. **No Circular Dependencies**: Interface breaks the cycle
2. **Single Source of Truth**: Repository holds the data
3. **Loose Coupling**: Graph only depends on interface, not concrete Store
4. **Testable**: Can create mock EntityProvider for testing
5. **Clean Separation**: Clear boundaries between layers

## Testing the Integration

In your integration tests, verify:

```go
// Create entity
store.Resources.Upsert(ctx, &oapi.Resource{Id: "r1", WorkspaceId: "ws1"})

// Query relationships (should compute lazily)
relations, err := store.Relationships.GetRelatedEntities(ctx, entity)
// First query triggers computation

// Query again (should use cache)
relations, err = store.Relationships.GetRelatedEntities(ctx, entity)
// Cached, no recomputation

// Update entity
store.Resources.Upsert(ctx, &oapi.Resource{Id: "r1", WorkspaceId: "ws2"})
// Graph is invalidated

// Query again (should recompute with new data)
relations, err = store.Relationships.GetRelatedEntities(ctx, entity)
// Recomputes with ws2
```

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│         Store Package                    │
│  ┌────────────────────────────────────┐  │
│  │ Store (implements EntityProvider)  │  │
│  │  - GetResources()                  │  │
│  │  - GetDeployments()                │  │
│  │  - GetEnvironments()               │  │
│  │  - GetRelationshipRules()          │  │
│  └────────────────────────────────────┘  │
│              │                            │
│              │ implements                 │
│              ↓                            │
│  ┌────────────────────────────────────┐  │
│  │    RelationshipRules               │  │
│  │      graph: *relationgraph.Graph   │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
              │
              │ uses
              ↓
┌─────────────────────────────────────────┐
│    Relationgraph Package                 │
│  ┌────────────────────────────────────┐  │
│  │  EntityProvider (interface)        │  │
│  │    - GetResources()                │  │
│  │    - GetDeployments()              │  │
│  │    - GetEnvironments()             │  │
│  │    - GetRelationshipRules()        │  │
│  └────────────────────────────────────┘  │
│              ↑                            │
│              │ depends on (interface)    │
│              │                            │
│  ┌────────────────────────────────────┐  │
│  │        Graph                       │  │
│  │  - EntityStore (uses interface)    │  │
│  │  - RelationshipCache               │  │
│  │  - ComputationEngine               │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

No circular dependency - relationgraph depends on an interface, Store implements it!
