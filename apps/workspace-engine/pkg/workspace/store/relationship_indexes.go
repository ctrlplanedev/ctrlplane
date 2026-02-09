package store

import (
	"context"
	"fmt"
	"strings"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
	v2 "workspace-engine/pkg/workspace/relationships/v2"

	"github.com/charmbracelet/log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var relationshipIndexesTracer = otel.Tracer("workspace/store/relationship_indexes")

// entityStoreAdapter adapts the workspace Store to the v2.Store interface,
// allowing relationship indexes to look up entities by ID across all entity
// types (resources, deployments, environments).
type entityStoreAdapter struct {
	store *Store
}

func (a *entityStoreAdapter) GetEntity(_ context.Context, entityID string) (*oapi.RelatableEntity, error) {
	if r, ok := a.store.Resources.Get(entityID); ok {
		return relationships.NewResourceEntity(r), nil
	}
	if d, ok := a.store.Deployments.Get(entityID); ok {
		return relationships.NewDeploymentEntity(d), nil
	}
	if e, ok := a.store.Environments.Get(entityID); ok {
		return relationships.NewEnvironmentEntity(e), nil
	}
	return nil, fmt.Errorf("entity not found: %s", entityID)
}

// indexEntry pairs a v2 relationship index with its original oapi rule.
type indexEntry struct {
	index    *v2.RelationshipIndex
	oapiRule *oapi.RelationshipRule
}

// RelationshipIndexes manages a set of v2.RelationshipIndex instances, one per
// relationship rule. It provides entity lifecycle operations that fan out to
// all indexes and an aggregated query interface compatible with existing
// consumers that expect map[string][]*oapi.EntityRelation.
type RelationshipIndexes struct {
	store       *Store
	entityStore *entityStoreAdapter

	indexes cmap.ConcurrentMap[string, *indexEntry] // keyed by rule ID
}

func NewRelationshipIndexes(store *Store) *RelationshipIndexes {
	return &RelationshipIndexes{
		store:       store,
		entityStore: &entityStoreAdapter{store: store},
		indexes:     cmap.New[*indexEntry](),
	}
}

// ============================================================================
// Rule-to-CEL conversion
// ============================================================================

// selectorToCel converts a Selector into a CEL fragment by extracting its CEL
// expression and replacing the entity-type variable (e.g. "resource", "deployment",
// "environment") with the given prefix ("from" or "to").
func selectorToCel(sel *oapi.Selector, entityType oapi.RelatableEntityType, prefix string) string {
	if sel == nil {
		return ""
	}
	cs, err := sel.AsCelSelector()
	if err != nil || cs.Cel == "" {
		return ""
	}
	// Replace the entity type variable name with the from/to prefix.
	// e.g. "resource.kind == 'vpc'" → "from.kind == 'vpc'"
	replaced := strings.ReplaceAll(cs.Cel, string(entityType)+".", prefix+".")
	return replaced
}

// ruleToCelExpression converts a full oapi.RelationshipRule into a single CEL
// expression string that encodes type filters, selector filters, and the matcher
// logic. This allows the v2 index to evaluate everything in one CEL pass.
func ruleToCelExpression(rule *oapi.RelationshipRule) string {
	parts := make([]string, 0, 6)

	// Type filters
	parts = append(parts,
		fmt.Sprintf(`from.type == "%s"`, rule.FromType),
		fmt.Sprintf(`to.type == "%s"`, rule.ToType),
	)

	// Selector filters (convert entity-type prefixed selectors to from/to prefixed)
	if fromSel := selectorToCel(rule.FromSelector, rule.FromType, "from"); fromSel != "" {
		parts = append(parts, "("+fromSel+")")
	}
	if toSel := selectorToCel(rule.ToSelector, rule.ToType, "to"); toSel != "" {
		parts = append(parts, "("+toSel+")")
	}

	// Matcher -- try CEL first, then property matcher
	cm, cmErr := rule.Matcher.AsCelMatcher()
	if cmErr == nil && cm.Cel != "" {
		parts = append(parts, "("+cm.Cel+")")
	}

	return strings.Join(parts, " && ")
}

// ruleToV2 converts an oapi.RelationshipRule into a v2.RelationshipRule by
// generating a pure CEL expression from the rule's type filters and matcher
// (CEL or property-based).
func ruleToV2(rule *oapi.RelationshipRule) *v2.RelationshipRule {
	celExpr := ruleToCelExpression(rule)
	if celExpr == "" {
		return nil
	}

	desc := ""
	if rule.Description != nil {
		desc = *rule.Description
	}

	return &v2.RelationshipRule{
		ID:          rule.Id,
		Name:        rule.Name,
		Description: desc,
		Reference:   rule.Reference,
		Matcher:     oapi.CelMatcher{Cel: celExpr},
	}
}

// --- Rule lifecycle ---

// AddRule creates a new relationship index for the given rule and populates it
// with all entities currently in the store. The index is marked dirty and must
// be recomputed via Recompute before queries return correct results.
func (ri *RelationshipIndexes) AddRule(ctx context.Context, rule *oapi.RelationshipRule) {
	ctx, span := relationshipIndexesTracer.Start(ctx, "RelationshipIndexes.AddRule")
	defer span.End()

	v2Rule := ruleToV2(rule)
	if v2Rule == nil {
		span.SetStatus(codes.Error, "failed to convert rule to v2")
		return
	}

	span.SetAttributes(
		attribute.String("rule.id", rule.Id),
		attribute.String("rule.name", rule.Name),
		attribute.String("rule.reference", rule.Reference),
		attribute.String("rule.from_type", string(rule.FromType)),
		attribute.String("rule.to_type", string(rule.ToType)),
	)

	idx := v2.NewRelationshipIndex(ri.entityStore, v2Rule)

	log.Info("Adding resources to rule", "rule.id", rule.Id)
	for _, r := range ri.store.Resources.Items() {
		idx.AddEntity(ctx, r.Id)
	}
	log.Info("Adding deployments to rule", "rule.id", rule.Id)
	for _, d := range ri.store.Deployments.Items() {
		idx.AddEntity(ctx, d.Id)
	}
	log.Info("Adding environments to rule", "rule.id", rule.Id)
	for _, e := range ri.store.Environments.Items() {
		idx.AddEntity(ctx, e.Id)
	}

	ri.indexes.Set(rule.Id, &indexEntry{index: idx, oapiRule: rule})
}

// RemoveRule drops the index for the given rule ID.
func (ri *RelationshipIndexes) RemoveRule(ruleID string) {
	ri.indexes.Remove(ruleID)
}

// UpdateRule replaces the index for a rule. This handles changes to the CEL
// expression by rebuilding the index from scratch.
func (ri *RelationshipIndexes) UpdateRule(ctx context.Context, rule *oapi.RelationshipRule) {
	ri.RemoveRule(rule.Id)
	ri.AddRule(ctx, rule)
}

// --- Entity lifecycle ---

// AddEntity registers an entity across all rule indexes.
func (ri *RelationshipIndexes) AddEntity(ctx context.Context, entityID string) {
	for _, entry := range ri.indexes.Items() {
		entry.index.AddEntity(ctx, entityID)
	}
}

// RemoveEntity removes an entity from all rule indexes.
func (ri *RelationshipIndexes) RemoveEntity(ctx context.Context, entityID string) {
	for _, entry := range ri.indexes.Items() {
		entry.index.RemoveEntity(ctx, entityID)
	}
}

// DirtyEntity marks an entity as changed across all rule indexes.
func (ri *RelationshipIndexes) DirtyEntity(ctx context.Context, entityID string) {
	for _, entry := range ri.indexes.Items() {
		entry.index.DirtyEntity(ctx, entityID)
	}
}

// DirtyAll marks all entities as changed across all rule indexes,
// forcing a full recomputation on the next Recompute call.
func (ri *RelationshipIndexes) DirtyAll(ctx context.Context) {
	for _, entry := range ri.indexes.Items() {
		entry.index.DirtyAll(ctx)
	}
}

// --- State ---

// IsDirty returns true if any rule index has dirty entities pending recomputation.
func (ri *RelationshipIndexes) IsDirty() bool {
	ctx := context.Background()
	for _, entry := range ri.indexes.Items() {
		if entry.index.IsDirty(ctx) {
			return true
		}
	}
	return false
}

// Recompute processes dirty state across all rule indexes.
// Returns the total number of match evaluations performed.
func (ri *RelationshipIndexes) Recompute(ctx context.Context) int {
	ctx, span := relationshipIndexesTracer.Start(ctx, "RelationshipIndexes.Recompute")
	defer span.End()

	total := 0
	for _, entry := range ri.indexes.Items() {
		total += entry.index.Recompute(ctx)
	}

	span.SetAttributes(
		attribute.Int("evaluations", total),
		attribute.Int("rules", ri.indexes.Count()),
	)
	return total
}

// --- Query ---

// GetRelatedEntities returns all entities related to the given entity across
// all rule indexes. Results are grouped by rule reference, matching the format
// expected by existing consumers (release manager, API layer, variable manager).
//
// For each rule index:
//   - Children (entity is "from", child is "to") produce Direction=From entries
//   - Parents (parent is "from", entity is "to") produce Direction=To entries
func (ri *RelationshipIndexes) GetRelatedEntities(ctx context.Context, entity *oapi.RelatableEntity) (map[string][]*oapi.EntityRelation, error) {
	ctx, span := relationshipIndexesTracer.Start(ctx, "RelationshipIndexes.GetRelatedEntities")
	defer span.End()

	entityID := entity.GetID()
	result := make(map[string][]*oapi.EntityRelation)

	totalRelations := 0

	for _, entry := range ri.indexes.Items() {
		ruleRef := entry.oapiRule.Reference

		for _, childID := range entry.index.GetChildren(ctx, entityID) {
			child, err := ri.entityStore.GetEntity(ctx, childID)
			if err != nil || child == nil {
				continue
			}
			result[ruleRef] = append(result[ruleRef], &oapi.EntityRelation{
				Direction:  oapi.From,
				Entity:     *child,
				EntityId:   child.GetID(),
				EntityType: child.GetType(),
				Rule:       *entry.oapiRule,
			})
			totalRelations++
		}

		for _, parentID := range entry.index.GetParents(ctx, entityID) {
			parent, err := ri.entityStore.GetEntity(ctx, parentID)
			if err != nil || parent == nil {
				continue
			}
			result[ruleRef] = append(result[ruleRef], &oapi.EntityRelation{
				Direction:  oapi.To,
				Entity:     *parent,
				EntityId:   parent.GetID(),
				EntityType: parent.GetType(),
				Rule:       *entry.oapiRule,
			})
			totalRelations++
		}
	}

	span.SetAttributes(
		attribute.String("entity.id", entityID),
		attribute.String("entity.type", string(entity.GetType())),
		attribute.Int("relations.total", totalRelations),
		attribute.Int("relations.rules", len(result)),
	)

	return result, nil
}
