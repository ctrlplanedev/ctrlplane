package variableresolver

import (
	"context"
	"fmt"
	"sort"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships/eval"
)

func NewResourceEntity(resource *oapi.Resource) *oapi.RelatableEntity {
	entity := &oapi.RelatableEntity{}
	_ = entity.FromResource(*resource)
	return entity
}

var tracer = otel.Tracer("desiredrelease/variableresolver")

// Scope carries the already-resolved entities for the release target so the
// resolver can evaluate CEL resource selectors and resolve reference
// variables without additional lookups.
type Scope struct {
	Resource    *oapi.Resource
	Deployment  *oapi.Deployment
	Environment *oapi.Environment
}

// Resolve computes the final set of variables for a release target.
//
// Resolution priority (per variable key):
//  1. Resource variable with matching key (highest priority)
//  2. Deployment variable value whose resource selector matches, sorted by
//     descending priority
//  3. Deployment variable default value
func Resolve(
	ctx context.Context,
	getter Getter,
	scope *Scope,
	deploymentID, resourceID string,
) (map[string]oapi.LiteralValue, error) {
	ctx, span := tracer.Start(ctx, "variableresolver.Resolve")
	defer span.End()

	span.SetAttributes(
		attribute.String("deployment.id", deploymentID),
		attribute.String("resource.id", resourceID),
	)

	deploymentVars, err := getter.GetDeploymentVariables(ctx, deploymentID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "get deployment variables failed")
		return nil, fmt.Errorf("get deployment variables: %w", err)
	}
	span.SetAttributes(attribute.Int("deployment_variables.count", len(deploymentVars)))

	if len(deploymentVars) == 0 {
		return map[string]oapi.LiteralValue{}, nil
	}

	resourceVars, err := getter.GetResourceVariables(ctx, resourceID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "get resource variables failed")
		return nil, fmt.Errorf("get resource variables: %w", err)
	}
	span.SetAttributes(attribute.Int("resource_variables.count", len(resourceVars)))

	wsID, err := uuid.Parse(scope.Resource.WorkspaceId)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}

	rules, err := getter.GetRelationshipRules(ctx, wsID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "get relationship rules failed")
		return nil, fmt.Errorf("get relationship rules: %w", err)
	}

	resolver := newRealtimeResolver(getter, scope.Resource, wsID, rules)

	entity := NewResourceEntity(scope.Resource)

	resolved := make(map[string]oapi.LiteralValue, len(deploymentVars))
	var fromResource, fromValue, fromDefault int

	for _, dv := range deploymentVars {
		key := dv.Variable.Key

		if lv := resolveFromResource(
			ctx,
			resolver,
			resourceID,
			key,
			resourceVars,
			entity,
		); lv != nil {
			resolved[key] = *lv
			fromResource++
			continue
		}

		if lv := resolveFromValues(
			ctx,
			resolver,
			resourceID,
			dv.Values,
			scope.Resource,
			entity,
		); lv != nil {
			resolved[key] = *lv
			fromValue++
			continue
		}

		if dv.Variable.DefaultValue != nil {
			resolved[key] = *dv.Variable.DefaultValue
			fromDefault++
		}
	}

	span.SetAttributes(
		attribute.Int("resolved.total", len(resolved)),
		attribute.Int("resolved.from_resource", fromResource),
		attribute.Int("resolved.from_value", fromValue),
		attribute.Int("resolved.from_default", fromDefault),
	)
	return resolved, nil
}

// realtimeResolver evaluates relationship rules in realtime to resolve
// references, ensuring no stale data is used.
type realtimeResolver struct {
	getter      Getter
	resource    *oapi.Resource
	workspaceID uuid.UUID
	rules       []eval.Rule
}

func newRealtimeResolver(
	getter Getter,
	resource *oapi.Resource,
	workspaceID uuid.UUID,
	rules []eval.Rule,
) *realtimeResolver {
	return &realtimeResolver{
		getter:      getter,
		resource:    resource,
		workspaceID: workspaceID,
		rules:       rules,
	}
}

func (r *realtimeResolver) LoadCandidates(
	ctx context.Context,
	workspaceID uuid.UUID,
	entityType string,
) ([]eval.EntityData, error) {
	return r.getter.LoadCandidates(ctx, workspaceID, entityType)
}

func (r *realtimeResolver) ResolveRelated(
	ctx context.Context,
	reference string,
) ([]*oapi.RelatableEntity, error) {
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

	matches, err := eval.ResolveForReference(ctx, r, entity, r.rules, reference)
	if err != nil {
		return nil, err
	}

	var result []*oapi.RelatableEntity
	for _, m := range matches {
		relatedID := m.ToEntityID
		relatedType := m.ToEntityType
		if m.ToEntityID == resID {
			relatedID = m.FromEntityID
			relatedType = m.FromEntityType
		}

		entity, err := r.getter.GetEntityByID(ctx, relatedID, relatedType)
		if err != nil {
			return nil, fmt.Errorf("get matched entity %s: %w", relatedID, err)
		}

		re, err := entityDataToRelatableEntity(entity)
		if err != nil {
			return nil, fmt.Errorf("convert matched entity: %w", err)
		}
		result = append(result, re)
	}

	return result, nil
}

// resolveFromResource checks if a resource variable exists for the given key
// and resolves it.
func resolveFromResource(
	ctx context.Context,
	resolver RelatedEntityResolver,
	resourceID string,
	key string,
	resourceVars map[string]oapi.ResourceVariable,
	entity *oapi.RelatableEntity,
) *oapi.LiteralValue {
	rv, ok := resourceVars[key]
	if !ok {
		return nil
	}
	lv, err := ResolveValue(ctx, resolver, resourceID, entity, &rv.Value)
	if err != nil {
		return nil
	}
	return lv
}

// resolveFromValues finds the highest-priority deployment variable value
// whose resource selector matches the target resource, then resolves it.
func resolveFromValues(
	ctx context.Context,
	resolver RelatedEntityResolver,
	resourceID string,
	values []oapi.DeploymentVariableValue,
	resource *oapi.Resource,
	entity *oapi.RelatableEntity,
) *oapi.LiteralValue {
	matched := make([]oapi.DeploymentVariableValue, 0, len(values))
	for _, v := range values {
		if v.ResourceSelector == nil {
			matched = append(matched, v)
			continue
		}
		ok, _ := selector.Match(ctx, *v.ResourceSelector, resource)
		if ok {
			matched = append(matched, v)
		}
	}
	if len(matched) == 0 {
		return nil
	}

	sort.Slice(matched, func(i, j int) bool {
		return matched[i].Priority > matched[j].Priority
	})

	for _, v := range matched {
		lv, err := ResolveValue(ctx, resolver, resourceID, entity, &v.Value)
		if err == nil && lv != nil {
			return lv
		}
	}
	return nil
}

func entityDataToRelatableEntity(data *eval.EntityData) (*oapi.RelatableEntity, error) {
	entity := &oapi.RelatableEntity{}

	switch data.EntityType {
	case "resource":
		r := mapToResource(data)
		if err := entity.FromResource(r); err != nil {
			return nil, err
		}
	case "deployment":
		d := mapToDeployment(data)
		if err := entity.FromDeployment(d); err != nil {
			return nil, err
		}
	case "environment":
		e := mapToEnvironment(data)
		if err := entity.FromEnvironment(e); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported entity type: %s", data.EntityType)
	}

	return entity, nil
}

func mapToResource(data *eval.EntityData) oapi.Resource {
	raw := data.Raw
	r := oapi.Resource{
		Id:          data.ID.String(),
		WorkspaceId: data.WorkspaceID.String(),
	}
	if v, ok := raw["name"].(string); ok {
		r.Name = v
	}
	if v, ok := raw["kind"].(string); ok {
		r.Kind = v
	}
	if v, ok := raw["version"].(string); ok {
		r.Version = v
	}
	if v, ok := raw["identifier"].(string); ok {
		r.Identifier = v
	}
	if v, ok := raw["config"].(map[string]any); ok {
		r.Config = v
	}
	if v, ok := raw["metadata"].(map[string]any); ok {
		md := make(map[string]string, len(v))
		for k, val := range v {
			if s, ok := val.(string); ok {
				md[k] = s
			}
		}
		r.Metadata = md
	}
	return r
}

func mapToDeployment(data *eval.EntityData) oapi.Deployment {
	raw := data.Raw
	d := oapi.Deployment{
		Id: data.ID.String(),
	}
	if v, ok := raw["name"].(string); ok {
		d.Name = v
	}
	if v, ok := raw["slug"].(string); ok {
		d.Slug = v
	}
	if v, ok := raw["description"].(string); ok {
		d.Description = &v
	}
	return d
}

func mapToEnvironment(data *eval.EntityData) oapi.Environment {
	raw := data.Raw
	e := oapi.Environment{
		Id: data.ID.String(),
	}
	if v, ok := raw["name"].(string); ok {
		e.Name = v
	}
	if v, ok := raw["description"].(string); ok {
		e.Description = &v
	}
	return e
}
