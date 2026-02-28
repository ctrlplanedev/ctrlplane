package variableresolver

import (
	"context"
	"fmt"
	"sort"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("desiredrelease/variableresolver")

// Getter provides the data needed to resolve deployment variables for a
// release target. Implementations backed by Postgres or in-memory mocks
// both satisfy this interface.
type Getter interface {
	GetDeploymentVariables(ctx context.Context, deploymentID string) ([]oapi.DeploymentVariableWithValues, error)
	GetResourceVariables(ctx context.Context, resourceID string) (map[string]oapi.ResourceVariable, error)
	GetRelatedEntity(ctx context.Context, resourceID, reference string) ([]*oapi.EntityRelation, error)
}

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

	entity := relationships.NewResourceEntity(scope.Resource)

	resolved := make(map[string]oapi.LiteralValue, len(deploymentVars))
	var fromResource, fromValue, fromDefault int

	for _, dv := range deploymentVars {
		key := dv.Variable.Key

		if lv := resolveFromResource(ctx, getter, resourceID, key, resourceVars, entity); lv != nil {
			resolved[key] = *lv
			fromResource++
			continue
		}

		if lv := resolveFromValues(ctx, getter, resourceID, dv.Values, scope.Resource, entity); lv != nil {
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

// resolveFromResource checks if a resource variable exists for the given key
// and resolves it.
func resolveFromResource(
	ctx context.Context,
	getter Getter,
	resourceID string,
	key string,
	resourceVars map[string]oapi.ResourceVariable,
	entity *oapi.RelatableEntity,
) *oapi.LiteralValue {
	rv, ok := resourceVars[key]
	if !ok {
		return nil
	}
	lv, err := ResolveValue(ctx, getter, resourceID, entity, &rv.Value)
	if err != nil {
		return nil
	}
	return lv
}

// resolveFromValues finds the highest-priority deployment variable value
// whose resource selector matches the target resource, then resolves it.
func resolveFromValues(
	ctx context.Context,
	getter Getter,
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
		ok, _ := selector.Match(ctx, v.ResourceSelector, resource)
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
		lv, err := ResolveValue(ctx, getter, resourceID, entity, &v.Value)
		if err == nil && lv != nil {
			return lv
		}
	}
	return nil
}
