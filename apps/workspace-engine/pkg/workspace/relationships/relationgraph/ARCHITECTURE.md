# Relationship Graph Architecture

## Overview

The relationship graph has been refactored into smaller, focused components for better organization, maintainability, and testability.

## Component Structure

### 1. **EntityStore** (`entity_store.go`)

**Responsibility**: Manages entity data (resources, deployments, environments, rules)

**Key Methods**:

- `GetAllEntities()` - Returns all entities as RelatableEntities
- `GetRules()` - Returns all relationship rules
- `GetRule(reference)` - Gets a specific rule
- `AddRule(rule)` - Adds/updates a rule
- `RemoveRule(reference)` - Removes a rule
- `EntityCount()`, `RuleCount()` - Statistics

**Thread-Safety**: Uses `sync.RWMutex` for concurrent access

### 2. **RelationshipCache** (`relationship_cache.go`)

**Responsibility**: Manages cached relationships and invalidation tracking

**Key Methods**:

- `Get(entityID)` - Returns cached relationships for an entity
- `GetBatch(entityIDs)` - Batch retrieval
- `Add(entityID, ruleRef, relation)` - Adds a relationship and updates reverse index
- `InvalidateEntity(entityID)` - Clears cache with cascade invalidation
- `InvalidateRule(ruleRef)` - Marks rule dirty and clears affected relationships
- `IsComputed(entityID)` - Checks if entity is cached
- `IsRuleDirty(ruleRef)` - Checks if rule needs recomputation
- `MarkEntityComputed(entityID)` - Marks entity as cached
- `Mark Rule ComputedForEntity(entityID, ruleRef)` - Tracks per-rule computation

**Key Features**:

- **Reverse Index** (`entityUsedIn`): Tracks which entities reference each entity for smart cascade invalidation
- **Dirty Rule Tracking**: Marks rules that need recomputation
- **Per-Rule Computation Tracking**: Knows which rules have been computed for which entities

**Thread-Safety**: Uses `sync.RWMutex` for concurrent access

### 3. **ComputationEngine** (`computation_engine.go`)

**Responsibility**: Handles the actual computation of relationships

**Key Methods**:

- `ComputeForEntity(ctx, entityID)` - Computes relationships for a single entity
- `processRuleForEntity(ctx, rule, targetEntity, allEntities)` - Evaluates one rule for one entity
- `filterEntities(ctx, entities, entityType, selector)` - Filters entities by type and selector
- `matchesSelector(ctx, targetType, targetSelector, entity)` - Checks if entity matches selector

**Dependencies**:

- Uses `EntityStore` to get entity data
- Writes results to `RelationshipCache`

**Features**:

- Selective rule evaluation (only rules involving entity type)
- Skips already-computed non-dirty rules
- Uses CEL matcher caching for performance

### 4. **Graph** (`graph.go`)

**Responsibility**: Orchestration layer and public API

**Key Methods**:

- `NewGraph()` - Creates empty graph
- `NewGraphWithStores(...)` - Creates graph with entity stores
- `GetRelatedEntities(entityID)` - O(1) cache lookup
- `GetRelatedEntitiesWithCompute(ctx, entityID)` - Lazy loading entry point
- `ComputeForEntity(ctx, entityID)` - Triggers computation
- `InvalidateEntity(entityID)` - Invalidates cache
- `InvalidateRule(ruleRef)` - Marks rule dirty
- `AddRule(rule)`, `RemoveRule(ruleRef)` - Rule management
- `GetStats()` - Returns statistics

**Composition**:

```go
type Graph struct {
    entityStore *EntityStore
    cache       *RelationshipCache
    engine      *ComputationEngine
    buildTime   time.Time
}
```

## Data Flow

### Lazy Loading Flow

```
User calls: graph.GetRelatedEntitiesWithCompute(ctx, "r1")
    ↓
Graph checks: cache.IsComputed("r1") && !cache.HasDirtyRules()
    ↓ (if not computed)
Graph calls: engine.ComputeForEntity(ctx, "r1")
    ↓
Engine gets: entityStore.GetAllEntities()
    ↓
Engine processes: Each rule for entity
    ↓
Engine writes: cache.Add(entityID, ruleRef, relation)
    ↓
Engine marks: cache.MarkEntityComputed("r1")
    ↓
Graph returns: cache.Get("r1")
```

### Invalidation Flow

```
User calls: graph.InvalidateEntity("d1")
    ↓
Graph delegates: cache.InvalidateEntity("d1")
    ↓
Cache clears: relations["d1"]
    ↓
Cache checks: entityUsedIn["d1"] (reverse index)
    ↓
Cache cascades: Invalidates ["r1", "r2", "r3"] (entities that reference d1)
```

### Rule Change Flow

```
User calls: graph.AddRule(newRule)
    ↓
Graph: entityStore.AddRule(newRule)
    ↓
Graph: cache.MarkRuleDirty(newRule.Reference)
    ↓
Next query: Detects dirty rule and recomputes
```

## Benefits of This Architecture

### 1. **Single Responsibility Principle**

- Each component has one clear purpose
- Easy to understand what each file does
- Changes are localized to specific components

### 2. **Testability**

- Can test cache invalidation independently
- Can test computation logic separately from storage
- Can mock components for unit testing

### 3. **Reusability**

- `RelationshipCache` could be used for other graph types
- `EntityStore` could be swapped for different storage backends
- `ComputationEngine` logic is independent of cache implementation

### 4. **Maintainability**

- Smaller files are easier to navigate (<300 lines each)
- Clear boundaries between concerns
- Easy to find and fix bugs

### 5. **Extensibility**

- Easy to add new entity types (modify `EntityStore`)
- Easy to add new caching strategies (modify `RelationshipCache`)
- Easy to add computation optimizations (modify `ComputationEngine`)

## File Organization

```
relationgraph/
├── entity_store.go           (~100 lines)  - Entity data management
├── relationship_cache.go     (~250 lines)  - Caching & invalidation
├── computation_engine.go     (~230 lines)  - Relationship computation
├── graph.go                  (~180 lines)  - Public API & orchestration
├── graph_test.go             (~1040 lines) - Tests
├── LAZY_LOADING.md                        - Usage documentation
└── ARCHITECTURE.md                        - This file
```

## Thread-Safety

All components are thread-safe:

- `EntityStore`: Uses `sync.RWMutex`
- `RelationshipCache`: Uses `sync.RWMutex`
- `ComputationEngine`: Stateless, delegates locking to cache
- `Graph`: Delegates locking to components

## Performance Characteristics

### Memory

- **EntityStore**: O(E + R) where E = entities, R = rules
- **RelationshipCache**: O(C) where C = computed relationships
- **ComputationEngine**: O(1) - no state
- **Total**: O(E + R + C)

### Time Complexity

- **First query**: O(N×M) where N,M = entity counts by type
- **Cached query**: O(1) lookup
- **Invalidation**: O(1) for entity, O(K) for rule where K = affected entities

## Future Enhancements

Potential improvements enabled by this architecture:

1. **Pluggable Cache Backends**: Replace `RelationshipCache` with Redis/Memcached
2. **Async Computation**: Add background workers in `ComputationEngine`
3. **Partial Invalidation**: Smarter dirty tracking in `RelationshipCache`
4. **Batch Computation**: Add batch methods to `ComputationEngine`
5. **Metrics & Monitoring**: Add instrumentation to each component
6. **Cache Eviction**: LRU policy in `RelationshipCache`

## Migration from Old Architecture

### Before (Monolithic Graph)

```go
type Graph struct {
    entityRelations map[string]map[string][]*oapi.EntityRelation
    resources    map[string]*oapi.Resource
    deployments  map[string]*oapi.Deployment
    environments map[string]*oapi.Environment
    rules map[string]*oapi.RelationshipRule
    computedEntities map[string]bool
    dirtyRules map[string]bool
    entityUsedIn map[string]map[string]bool
    computedForRule map[string]map[string]bool
    // ... 500+ lines of methods in one file
}
```

### After (Component-Based)

```go
type Graph struct {
    entityStore *EntityStore      // ~100 lines
    cache       *RelationshipCache // ~250 lines
    engine      *ComputationEngine // ~230 lines
}
```

### API Compatibility

The public API remains **100% compatible**:

```go
// All these still work exactly the same
graph := NewGraphWithStores(resources, deployments, environments, rules)
relations, err := graph.GetRelatedEntitiesWithCompute(ctx, "r1")
graph.InvalidateEntity("r1")
graph.AddRule(newRule)
```

## Conclusion

This refactoring improves code organization without changing functionality:

- ✅ All tests pass
- ✅ Public API unchanged
- ✅ Better organization
- ✅ Easier to maintain
- ✅ Easier to test
- ✅ Easier to extend
