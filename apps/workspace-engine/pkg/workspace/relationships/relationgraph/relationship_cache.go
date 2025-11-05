package relationgraph

import (
	"maps"
	"sync"

	"workspace-engine/pkg/oapi"
)

// RelationshipCache manages cached relationships and invalidation tracking
// It provides thread-safe access to the relationship cache and tracks computation state
type RelationshipCache struct {
	// Cached relationships: entityID -> ruleReference -> relations
	relations map[string]map[string][]*oapi.EntityRelation

	// Lazy loading tracking
	computedEntities map[string]bool                    // tracks which entities have been computed
	dirtyRules       map[string]bool                    // tracks which rules need recomputation
	entityUsedIn     map[string]map[string]bool         // reverse index: entityID -> set of entityIDs that reference it
	computedForRule  map[string]map[string]bool         // tracks entity+rule computations: entityID -> ruleRef -> computed

	// Statistics
	relationCount int

	mu sync.RWMutex
}

// NewRelationshipCache creates a new empty relationship cache
func NewRelationshipCache() *RelationshipCache {
	return &RelationshipCache{
		relations:        make(map[string]map[string][]*oapi.EntityRelation),
		computedEntities: make(map[string]bool),
		dirtyRules:       make(map[string]bool),
		entityUsedIn:     make(map[string]map[string]bool),
		computedForRule:  make(map[string]map[string]bool),
	}
}

// Get returns cached relationships for an entity (returns copy)
func (c *RelationshipCache) Get(entityID string) map[string][]*oapi.EntityRelation {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if relations, ok := c.relations[entityID]; ok {
		// Return a copy to prevent external mutation
		result := make(map[string][]*oapi.EntityRelation, len(relations))
		maps.Copy(result, relations)
		return result
	}

	return make(map[string][]*oapi.EntityRelation)
}

// GetBatch returns cached relationships for multiple entities
func (c *RelationshipCache) GetBatch(entityIDs []string) map[string]map[string][]*oapi.EntityRelation {
	c.mu.RLock()
	defer c.mu.RUnlock()

	results := make(map[string]map[string][]*oapi.EntityRelation, len(entityIDs))
	for _, entityID := range entityIDs {
		if relations, ok := c.relations[entityID]; ok {
			results[entityID] = relations
		} else {
			results[entityID] = make(map[string][]*oapi.EntityRelation)
		}
	}

	return results
}

// Add adds a relationship to the cache and updates the reverse index
func (c *RelationshipCache) Add(entityID string, ruleReference string, relation *oapi.EntityRelation) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.relations[entityID] == nil {
		c.relations[entityID] = make(map[string][]*oapi.EntityRelation)
	}
	c.relations[entityID][ruleReference] = append(
		c.relations[entityID][ruleReference],
		relation,
	)
	c.relationCount++

	// Track reverse index: the related entity is "used in" this entity
	relatedEntityID := relation.EntityId
	if c.entityUsedIn[relatedEntityID] == nil {
		c.entityUsedIn[relatedEntityID] = make(map[string]bool)
	}
	c.entityUsedIn[relatedEntityID][entityID] = true
}

// HasRelationships checks if an entity has any cached relationships
func (c *RelationshipCache) HasRelationships(entityID string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	relations, ok := c.relations[entityID]
	return ok && len(relations) > 0
}

// IsComputed checks if an entity has had its relationships computed
func (c *RelationshipCache) IsComputed(entityID string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.computedEntities[entityID]
}

// IsRuleDirty checks if a rule needs recomputation
func (c *RelationshipCache) IsRuleDirty(ruleRef string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.dirtyRules[ruleRef]
}

// MarkEntityComputed marks an entity as having been computed
func (c *RelationshipCache) MarkEntityComputed(entityID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.computedEntities[entityID] = true
}

// MarkRuleComputedForEntity marks a rule as computed for a specific entity
func (c *RelationshipCache) MarkRuleComputedForEntity(entityID string, ruleRef string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.computedForRule[entityID] == nil {
		c.computedForRule[entityID] = make(map[string]bool)
	}
	c.computedForRule[entityID][ruleRef] = true
	delete(c.dirtyRules, ruleRef) // Rule is no longer dirty for this entity
}

// InvalidateEntity clears the cached relationships for a specific entity
// Also cascades invalidation to entities that reference it (via reverse index)
func (c *RelationshipCache) InvalidateEntity(entityID string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Clear the entity's relationships
	delete(c.relations, entityID)
	delete(c.computedEntities, entityID)
	delete(c.computedForRule, entityID)

	// Also invalidate entities that reference this entity
	if relatedEntities, ok := c.entityUsedIn[entityID]; ok {
		for relatedID := range relatedEntities {
			delete(c.relations, relatedID)
			delete(c.computedEntities, relatedID)
			delete(c.computedForRule, relatedID)
		}
	}

	// Clear reverse index for this entity
	delete(c.entityUsedIn, entityID)
}

// InvalidateRule marks a rule as dirty and clears all relationships using that rule
func (c *RelationshipCache) InvalidateRule(ruleRef string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.dirtyRules[ruleRef] = true

	// Clear relationships for all entities that have this rule
	for entityID, rules := range c.relations {
		if _, hasRule := rules[ruleRef]; hasRule {
			delete(rules, ruleRef)
			// If entity has no more relationships, remove it entirely
			if len(rules) == 0 {
				delete(c.relations, entityID)
				delete(c.computedEntities, entityID)
			}
		}
		// Mark this rule as needing recomputation for this entity
		if c.computedForRule[entityID] != nil {
			delete(c.computedForRule[entityID], ruleRef)
		}
	}
}

// MarkRuleDirty marks a rule as needing recomputation
func (c *RelationshipCache) MarkRuleDirty(ruleRef string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.dirtyRules[ruleRef] = true
}

// ClearRuleDirty removes the dirty flag from a rule
func (c *RelationshipCache) ClearRuleDirty(ruleRef string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.dirtyRules, ruleRef)
}

// HasDirtyRules checks if there are any dirty rules
func (c *RelationshipCache) HasDirtyRules() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.dirtyRules) > 0
}

// IsRuleComputedForEntity checks if a specific rule has been computed for an entity
func (c *RelationshipCache) IsRuleComputedForEntity(entityID string, ruleRef string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.computedForRule[entityID] != nil && c.computedForRule[entityID][ruleRef]
}

// RelationCount returns the total number of cached relationships
func (c *RelationshipCache) RelationCount() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.relationCount
}

// GetRelationsByReference returns all relationships for a specific rule reference
func (c *RelationshipCache) GetRelationsByReference(reference string) map[string][]*oapi.EntityRelation {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make(map[string][]*oapi.EntityRelation)
	for entityID, relations := range c.relations {
		if rels, ok := relations[reference]; ok {
			result[entityID] = rels
		}
	}

	return result
}

