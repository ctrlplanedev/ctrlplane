package variables

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/variablemanager")

type Manager struct {
	store *store.Store
}

func New(store *store.Store) *Manager {
	return &Manager{store: store}
}

type DeploymentVariableWithValues struct {
	DeploymentVariable *oapi.DeploymentVariable
	Values             map[string]*oapi.DeploymentVariableValue
}

func (m *Manager) Evaluate(ctx context.Context, releaseTarget *oapi.ReleaseTarget, relatedEntities map[string][]*oapi.EntityRelation) (map[string]*oapi.LiteralValue, error) {
	ctx, span := tracer.Start(ctx, "VariableManager.Evaluate", trace.WithAttributes(
		attribute.String("deployment.id", releaseTarget.DeploymentId),
		attribute.String("environment.id", releaseTarget.EnvironmentId),
		attribute.String("resource.id", releaseTarget.ResourceId),
	))
	defer span.End()

	resolvedVariables := make(map[string]*oapi.LiteralValue)

	// Get the resource and prepare entity for variable resolution
	span.AddEvent("Getting resource for variable evaluation")
	resource, exists := m.store.Resources.Get(releaseTarget.ResourceId)
	if !exists {
		err := fmt.Errorf("resource %q not found", releaseTarget.ResourceId)
		span.RecordError(err)
		return nil, err
	}
	span.SetAttributes(attribute.String("resource.name", resource.Name))
	entity := relationships.NewResourceEntity(resource)

	// Count related entities for context
	totalRelatedEntities := 0
	for _, entities := range relatedEntities {
		totalRelatedEntities += len(entities)
	}
	span.SetAttributes(attribute.Int("related_entities.count", totalRelatedEntities))

	// Load resource variables once for lookup
	span.AddEvent("Loading resource variables")
	resourceVariables := m.store.Resources.Variables(releaseTarget.ResourceId)
	span.SetAttributes(attribute.Int("resource_variables.count", len(resourceVariables)))

	// Process each deployment variable (only deployment variables are included in releases)
	span.AddEvent("Loading deployment variables")
	deploymentVariables := m.store.Deployments.Variables(releaseTarget.DeploymentId)
	span.SetAttributes(attribute.Int("deployment_variables.count", len(deploymentVariables)))

	span.AddEvent("Resolving variables")
	resolvedFromResource := 0
	resolvedFromValue := 0
	resolvedFromDefault := 0

	for key, deploymentVar := range deploymentVariables {
		// Resolution priority:
		// 1. Resource variable (if it exists with the same key)
		// 2. Deployment variable values (sorted by priority, filtered by resource selector)
		// 3. Deployment variable default value

		resolved := m.tryResolveResourceVariable(ctx, key, resourceVariables, entity, relatedEntities)
		if resolved != nil {
			resolvedVariables[key] = resolved
			resolvedFromResource++
			continue
		}

		resolved = m.tryResolveDeploymentVariableValue(ctx, deploymentVar, resource, entity, relatedEntities)
		if resolved != nil {
			resolvedVariables[key] = resolved
			resolvedFromValue++
			continue
		}

		// Fallback to default value if available
		if deploymentVar.DefaultValue != nil {
			resolvedVariables[key] = deploymentVar.DefaultValue
			resolvedFromDefault++
		}
	}

	span.SetAttributes(
		attribute.Int("resolved.total", len(resolvedVariables)),
		attribute.Int("resolved.from_resource", resolvedFromResource),
		attribute.Int("resolved.from_value", resolvedFromValue),
		attribute.Int("resolved.from_default", resolvedFromDefault),
	)

	var vars []string
	for key, value := range resolvedVariables {
		if value != nil {
			if jsonBytes, err := json.Marshal(value); err == nil {
				vars = append(vars, fmt.Sprintf("%s: %s", key, string(jsonBytes)))
			}
		}
	}
	span.SetAttributes(attribute.String("resolved_variables", strings.Join(vars, ", ")))

	return resolvedVariables, nil
}

// tryResolveResourceVariable attempts to resolve a variable from resource variables
func (m *Manager) tryResolveResourceVariable(
	ctx context.Context,
	key string,
	resourceVariables map[string]*oapi.ResourceVariable,
	entity *oapi.RelatableEntity,
	relatedEntities map[string][]*oapi.EntityRelation,
) *oapi.LiteralValue {
	ctx, span := tracer.Start(ctx, "tryResolveResourceVariable",
		trace.WithAttributes(
			attribute.String("variable.key", key),
		))
	defer span.End()

	resourceVar, exists := resourceVariables[key]
	if !exists {
		span.SetAttributes(attribute.Bool("found", false))
		return nil
	}

	span.SetAttributes(attribute.Bool("found", true))
	span.AddEvent("Resolving resource variable value")
	result, err := m.store.Variables.ResolveValue(ctx, entity, &resourceVar.Value, relatedEntities)
	if err != nil {
		span.RecordError(err)
		span.SetAttributes(attribute.Bool("resolved", false))
		return nil
	}

	span.SetAttributes(attribute.Bool("resolved", result != nil))
	return result
}

// tryResolveDeploymentVariableValue attempts to resolve a variable from deployment variable values
func (m *Manager) tryResolveDeploymentVariableValue(
	ctx context.Context,
	deploymentVar *oapi.DeploymentVariable,
	resource *oapi.Resource,
	entity *oapi.RelatableEntity,
	relatedEntities map[string][]*oapi.EntityRelation,
) *oapi.LiteralValue {
	ctx, span := tracer.Start(ctx, "tryResolveDeploymentVariableValue",
		trace.WithAttributes(
			attribute.String("variable.key", deploymentVar.Key),
			attribute.String("variable.id", deploymentVar.Id),
		))
	defer span.End()

	values := m.store.DeploymentVariables.Values(deploymentVar.Id)
	span.SetAttributes(attribute.Int("values.total", len(values)))

	span.AddEvent("Filtering values by resource selector")
	// Sort values by priority (higher priority first)
	sortedValues := make([]*oapi.DeploymentVariableValue, 0, len(values))
	for _, value := range values {
		matches, _ := selector.Match(ctx, value.ResourceSelector, resource)
		if !matches {
			continue
		}
		sortedValues = append(sortedValues, value)
	}

	span.SetAttributes(attribute.Int("values.matching", len(sortedValues)))

	if len(sortedValues) == 0 {
		span.SetAttributes(attribute.Bool("resolved", false))
		return nil
	}

	span.AddEvent("Sorting values by priority")
	sort.Slice(sortedValues, func(i, j int) bool {
		return sortedValues[i].Priority > sortedValues[j].Priority
	})

	span.SetAttributes(attribute.Int64("values.highest_priority", sortedValues[0].Priority))

	// Find first matching value based on resource selector
	span.AddEvent("Resolving value from sorted candidates")
	for i, value := range sortedValues {
		result, _ := m.store.Variables.ResolveValue(ctx, entity, &value.Value, relatedEntities)
		if result != nil {
			span.SetAttributes(
				attribute.Bool("resolved", true),
				attribute.Int64("value.priority", value.Priority),
				attribute.Int("values.tried", i+1),
			)
			return result
		}
	}

	span.SetAttributes(
		attribute.Bool("resolved", false),
		attribute.Int("values.tried", len(sortedValues)),
	)
	return nil
}
