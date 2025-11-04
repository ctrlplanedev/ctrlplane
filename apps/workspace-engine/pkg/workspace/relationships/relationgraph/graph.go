package relationgraph

import (
	"maps"
	"sync"
	"time"

	"workspace-engine/pkg/oapi"
)

// Graph is a precomputed index of all entity relationships.
// It provides O(1) lookups after an initial O(N×M) build phase.
// The graph uses an adjacency list representation internally.
type Graph struct {
	// entityRelations maps entity ID -> relationship reference -> related entities
	entityRelations map[string]map[string][]*oapi.EntityRelation

	// metadata
	buildTime     time.Time
	entityCount   int
	ruleCount     int
	relationCount int

	mu sync.RWMutex
}

// NewGraph creates an empty relationship graph
func NewGraph() *Graph {
	return &Graph{
		entityRelations: make(map[string]map[string][]*oapi.EntityRelation),
		buildTime:       time.Now(),
	}
}

// GetRelatedEntities returns all relationships for a single entity
// Returns empty map if entity has no relationships
// This is an O(1) lookup operation
func (g *Graph) GetRelatedEntities(entityID string) map[string][]*oapi.EntityRelation {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if relations, ok := g.entityRelations[entityID]; ok {
		// Return a copy to prevent external mutation
		result := make(map[string][]*oapi.EntityRelation, len(relations))
		maps.Copy(result, relations)
		return result
	}

	return make(map[string][]*oapi.EntityRelation)
}

// GetRelatedEntitiesBatch returns relationships for multiple entities at once
// More efficient than calling GetRelatedEntities in a loop
func (g *Graph) GetRelatedEntitiesBatch(entityIDs []string) map[string]map[string][]*oapi.EntityRelation {
	g.mu.RLock()
	defer g.mu.RUnlock()

	results := make(map[string]map[string][]*oapi.EntityRelation, len(entityIDs))
	for _, entityID := range entityIDs {
		if relations, ok := g.entityRelations[entityID]; ok {
			results[entityID] = relations
		} else {
			results[entityID] = make(map[string][]*oapi.EntityRelation)
		}
	}

	return results
}

// GetRelationsByReference returns all relationships for a specific reference
// across all entities that have that relationship
func (g *Graph) GetRelationsByReference(reference string) map[string][]*oapi.EntityRelation {
	g.mu.RLock()
	defer g.mu.RUnlock()

	result := make(map[string][]*oapi.EntityRelation)
	for entityID, relations := range g.entityRelations {
		if rels, ok := relations[reference]; ok {
			result[entityID] = rels
		}
	}

	return result
}

// HasRelationships checks if an entity has any relationships
func (g *Graph) HasRelationships(entityID string) bool {
	g.mu.RLock()
	defer g.mu.RUnlock()

	relations, ok := g.entityRelations[entityID]
	return ok && len(relations) > 0
}

// IsStale checks if the graph is older than the given TTL
func (g *Graph) IsStale(ttl time.Duration) bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return time.Since(g.buildTime) > ttl
}

// GetStats returns statistics about the graph
func (g *Graph) GetStats() Stats {
	g.mu.RLock()
	defer g.mu.RUnlock()

	return Stats{
		EntityCount:   g.entityCount,
		RuleCount:     g.ruleCount,
		RelationCount: g.relationCount,
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

// addRelation adds a relationship to the graph (internal use only)
func (g *Graph) addRelation(entityID string, reference string, relation *oapi.EntityRelation) {
	if g.entityRelations[entityID] == nil {
		g.entityRelations[entityID] = make(map[string][]*oapi.EntityRelation)
	}
	g.entityRelations[entityID][reference] = append(
		g.entityRelations[entityID][reference],
		relation,
	)
	g.relationCount++
}
