package relationgraph

import (
	"context"
	"time"

	"workspace-engine/pkg/oapi"

	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace/relationships/relationgraph")

// Graph is a lazy-loading index of entity relationships.
// It computes relationships on-demand and caches them per entity.
// The graph orchestrates between EntityStore, RelationshipCache, and ComputationEngine.
type Graph struct {
	entityStore *EntityStore
	cache       *RelationshipCache
	engine      *ComputationEngine

	buildTime time.Time
}

// NewGraph creates a relationship graph from an EntityProvider (e.g., Store)
// This uses dependency inversion to avoid circular dependencies
func NewGraph(provider EntityProvider) *Graph {
	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	return &Graph{
		entityStore: entityStore,
		cache:       cache,
		engine:      engine,
		buildTime:   time.Now(),
	}
}

// NewGraphWithComponents creates a graph with custom components (for testing/advanced use)
func NewGraphWithComponents(entityStore *EntityStore, cache *RelationshipCache, engine *ComputationEngine) *Graph {
	return &Graph{
		entityStore: entityStore,
		cache:       cache,
		engine:      engine,
		buildTime:   time.Now(),
	}
}

// InvalidateEntity clears the cached relationships for a specific entity
// Call this when an entity is updated/deleted in the store layer
func (g *Graph) InvalidateEntity(entityID string) {
	g.cache.InvalidateEntity(entityID)
}

// InvalidateRule marks a rule as dirty and clears all relationships using that rule
// Call this when a rule is added/updated/removed in the store layer
func (g *Graph) InvalidateRule(ruleRef string) {
	g.cache.InvalidateRule(ruleRef)
}

// IsComputed checks if an entity has had its relationships computed
func (g *Graph) IsComputed(entityID string) bool {
	return g.cache.IsComputed(entityID)
}

// IsRuleDirty checks if a rule needs recomputation
func (g *Graph) IsRuleDirty(ruleRef string) bool {
	return g.cache.IsRuleDirty(ruleRef)
}

// GetRelatedEntities returns all relationships for a single entity
// Returns empty map if entity has no relationships
// This is an O(1) lookup operation for cached entities
func (g *Graph) GetRelatedEntities(entityID string) map[string][]*oapi.EntityRelation {
	return g.cache.Get(entityID)
}

// GetRelatedEntitiesWithCompute returns relationships for an entity, computing them if needed
// This is the main entry point for lazy-loading relationship computation
func (g *Graph) GetRelatedEntitiesWithCompute(ctx context.Context, entityID string) (map[string][]*oapi.EntityRelation, error) {
	// Check if we need to compute
	needsCompute := !g.cache.IsComputed(entityID) || g.cache.HasDirtyRules()

	if needsCompute {
		// Compute relationships for this entity
		if err := g.ComputeForEntity(ctx, entityID); err != nil {
			return nil, err
		}
	}

	// Return the (now computed) relationships
	return g.GetRelatedEntities(entityID), nil
}

// GetRelatedEntitiesBatch returns relationships for multiple entities at once
// More efficient than calling GetRelatedEntities in a loop
func (g *Graph) GetRelatedEntitiesBatch(entityIDs []string) map[string]map[string][]*oapi.EntityRelation {
	return g.cache.GetBatch(entityIDs)
}

// GetRelationsByReference returns all relationships for a specific reference
// across all entities that have that relationship
func (g *Graph) GetRelationsByReference(reference string) map[string][]*oapi.EntityRelation {
	return g.cache.GetRelationsByReference(reference)
}

// HasRelationships checks if an entity has any relationships
func (g *Graph) HasRelationships(entityID string) bool {
	return g.cache.HasRelationships(entityID)
}

// IsStale checks if the graph is older than the given TTL
func (g *Graph) IsStale(ttl time.Duration) bool {
	return time.Since(g.buildTime) > ttl
}

// GetStats returns statistics about the graph
func (g *Graph) GetStats() Stats {
	return Stats{
		EntityCount:   g.entityStore.EntityCount(),
		RuleCount:     g.entityStore.RuleCount(),
		RelationCount: g.cache.RelationCount(),
		BuildTime:     g.buildTime,
		Age:           time.Since(g.buildTime),
	}
}

// Stats contains statistics about the relationship graph
type Stats struct {
	EntityCount   int
	RuleCount     int
	RelationCount int
	BuildTime     time.Time
	Age           time.Duration
}

// ComputeForEntity computes relationships for a single entity across all rules
// This delegates to the ComputationEngine
func (g *Graph) ComputeForEntity(ctx context.Context, entityID string) error {
	return g.engine.ComputeForEntity(ctx, entityID)
}

// Internal test helpers - these expose internal cache/engine methods for testing

// addRelation adds a relationship directly to the cache (for testing)
func (g *Graph) addRelation(entityID string, reference string, relation *oapi.EntityRelation) {
	g.cache.Add(entityID, reference, relation)
}

// markEntityComputed marks an entity as computed (for testing)
func (g *Graph) markEntityComputed(entityID string) {
	g.cache.MarkEntityComputed(entityID)
}

// hasRule checks if a rule exists (for testing)
func (g *Graph) hasRule(reference string) bool {
	_, ok := g.entityStore.GetRule(reference)
	return ok
}
