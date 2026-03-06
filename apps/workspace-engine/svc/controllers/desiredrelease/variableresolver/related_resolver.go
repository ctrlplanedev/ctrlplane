package variableresolver

import (
	"context"
	"fmt"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/eval"

	"github.com/google/uuid"
)

// RelatedEntityResolver resolves a reference name to the matched related
// entities for a resource. Implementations may evaluate relationship rules
// in realtime or return pre-computed/mocked results.
type RelatedEntityResolver interface {
	ResolveRelated(ctx context.Context, reference string) ([]*eval.EntityData, error)
}

var _ RelatedEntityResolver = (*realtimeResolver)(nil)

// realtimeResolver evaluates relationship rules in realtime to resolve
// references, ensuring no stale data is used.
type realtimeResolver struct {
	resource    *oapi.Resource
	workspaceID uuid.UUID
	rules       []eval.Rule
}

func newRealtimeResolver(getter Getter, resource *oapi.Resource, workspaceID uuid.UUID, rules []eval.Rule) *realtimeResolver {
	return &realtimeResolver{
		resource:    resource,
		workspaceID: workspaceID,
		rules:       rules,
	}
}

func (r *realtimeResolver) ResolveRelated(ctx context.Context, reference string) ([]*eval.EntityData, error) {
	resID, err := uuid.Parse(r.resource.Id)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}

	rawMap, err := celutil.EntityToMap(r.resource)
	if err != nil {
		return nil, fmt.Errorf("convert resource to map: %w", err)
	}
	rawMap["type"] = "resource"

	entity := &eval.EntityData{
		ID:          resID,
		WorkspaceID: r.workspaceID,
		EntityType:  "resource",
		Raw:         rawMap,
	}

	canadateEntities, err := r.GetAllEntities(ctx, r.workspaceID)
	if err != nil {
		return nil, fmt.Errorf("get all entities: %w", err)
	}

	candidateMap := make(map[string]*eval.EntityData)
	for _, entity := range canadateEntities {
		candidateMap[entity.EntityType + "-" + entity.ID.String()] = &entity
	}

	rules := []eval.Rule{}
	for _, rule := range r.rules {
		if rule.Reference == reference {
			rules = append(rules, rule)
		}
	}

	matches, err := eval.EvaluateRules(ctx, entity, canadateEntities, rules)
	if err != nil {
		return nil, err
	}

	entities := make([]*eval.EntityData, 0, len(matches))
	for _, match := range matches {
		entity, ok := candidateMap[match.ToEntityType + "-" + match.ToEntityID.String()]
		if !ok {
			return nil, fmt.Errorf("matched entity not found: %s-%s", match.ToEntityType, match.ToEntityID.String())
		}
		entities = append(entities, entity)
	}

	return entities, nil
}
