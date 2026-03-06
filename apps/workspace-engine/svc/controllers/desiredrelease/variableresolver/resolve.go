package variableresolver

import (
	"context"
	"fmt"
	"sort"

	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships/eval"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("desiredrelease/variableresolver")

// Getter provides the data needed to resolve deployment variables for a
// release target.
type Getter interface {
	GetDeploymentVariables(ctx context.Context, deploymentID string) ([]oapi.DeploymentVariableWithValues, error)
	GetResourceVariables(ctx context.Context, resourceID string) (map[string]oapi.ResourceVariable, error)
	GetRelationshipRules(ctx context.Context, workspaceID uuid.UUID) ([]eval.Rule, error)
	GetAllEntities(ctx context.Context, workspaceID uuid.UUID) ([]eval.EntityData, error)
}

// Scope carries the already-resolved entities for the release target.
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
) (map[string]oapi.LiteralValue, error) {
	ctx, span := tracer.Start(ctx, "variableresolver.Resolve")
	defer span.End()

	deploymentID := scope.Deployment.Id
	resourceID := scope.Resource.Id

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

	rc, err := buildResolveContext(ctx, getter, scope.Resource)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	resolved := make(map[string]oapi.LiteralValue, len(deploymentVars))
	for _, dv := range deploymentVars {
		key := dv.Variable.Key

		if rv, ok := resourceVars[key]; ok {
			if lv := resolveValue(ctx, rc.resolveRelated, &rv.Value); lv != nil {
				resolved[key] = *lv
				continue
			}
		}

		if lv := resolveFromValues(ctx, rc, dv.Values, scope.Resource); lv != nil {
			resolved[key] = *lv
			continue
		}

		if dv.Variable.DefaultValue != nil {
			resolved[key] = *dv.Variable.DefaultValue
		}
	}

	return resolved, nil
}

func buildResolveContext(ctx context.Context, getter Getter, resource *oapi.Resource) (*resolveContext, error) {
	wsID, err := uuid.Parse(resource.WorkspaceId)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}
	resID, err := uuid.Parse(resource.Id)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}

	rules, err := getter.GetRelationshipRules(ctx, wsID)
	if err != nil {
		return nil, fmt.Errorf("get relationship rules: %w", err)
	}

	allCandidates, err := getter.GetAllEntities(ctx, wsID)
	if err != nil {
		return nil, fmt.Errorf("get all entities: %w", err)
	}

	rawMap, err := celutil.EntityToMap(resource)
	if err != nil {
		return nil, fmt.Errorf("convert resource to CEL map: %w", err)
	}
	rawMap["type"] = "resource"

	candidateIdx := make(map[string]*eval.EntityData, len(allCandidates))
	for i := range allCandidates {
		c := &allCandidates[i]
		candidateIdx[c.EntityType+"-"+c.ID.String()] = c
	}

	return &resolveContext{
		entity: &eval.EntityData{
			ID: resID, WorkspaceID: wsID,
			EntityType: "resource", Raw: rawMap,
		},
		rules:        rules,
		candidates:   allCandidates,
		candidateIdx: candidateIdx,
	}, nil
}

// resolveFromValues finds the highest-priority deployment variable value
// whose resource selector matches the target resource, then resolves it.
func resolveFromValues(
	ctx context.Context,
	rc *resolveContext,
	values []oapi.DeploymentVariableValue,
	resource *oapi.Resource,
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
		if lv := resolveValue(ctx, rc.resolveRelated, &v.Value); lv != nil {
			return lv
		}
	}
	return nil
}
