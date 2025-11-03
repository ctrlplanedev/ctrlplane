package variables

import (
	"context"
	"fmt"
	"sort"
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

func (m *Manager) Evaluate(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (map[string]*oapi.LiteralValue, error) {
	ctx, span := tracer.Start(ctx, "VariableManager.Evaluate", trace.WithAttributes(
		attribute.String("deployment.id", releaseTarget.DeploymentId),
		attribute.String("environment.id", releaseTarget.EnvironmentId),
		attribute.String("resource.id", releaseTarget.ResourceId),
	))
	defer span.End()

	resolvedVariables := make(map[string]*oapi.LiteralValue)

	// Get the resource and prepare entity for variable resolution
	resource, exists := m.store.Resources.Get(releaseTarget.ResourceId)
	if !exists {
		return nil, fmt.Errorf("resource %q not found", releaseTarget.ResourceId)
	}
	entity := relationships.NewResourceEntity(resource)

	// Load resource variables once for lookup
	resourceVariables := m.store.Resources.Variables(releaseTarget.ResourceId)

	// Process each deployment variable (only deployment variables are included in releases)
	deploymentVariables := m.store.Deployments.Variables(releaseTarget.DeploymentId)
	for key, deploymentVar := range deploymentVariables {
		// Resolution priority:
		// 1. Resource variable (if it exists with the same key)
		// 2. Deployment variable values (sorted by priority, filtered by resource selector)
		// 3. Deployment variable default value

		resolved := m.tryResolveResourceVariable(ctx, span, key, resourceVariables, entity)
		if resolved != nil {
			resolvedVariables[key] = resolved
			continue
		}

		resolved = m.tryResolveDeploymentVariableValue(ctx, span, key, deploymentVar, resource, entity)
		if resolved != nil {
			resolvedVariables[key] = resolved
			continue
		}

		// Fallback to default value if available
		if deploymentVar.DefaultValue != nil {
			resolvedVariables[key] = deploymentVar.DefaultValue
		}
	}

	return resolvedVariables, nil
}

// tryResolveResourceVariable attempts to resolve a variable from resource variables
func (m *Manager) tryResolveResourceVariable(
	ctx context.Context,
	span trace.Span,
	key string,
	resourceVariables map[string]*oapi.ResourceVariable,
	entity *oapi.RelatableEntity,
) *oapi.LiteralValue {
	resourceVar, exists := resourceVariables[key]
	if !exists {
		return nil
	}

	result, err := m.store.Variables.ResolveValue(ctx, entity, &resourceVar.Value)
	if err != nil {
		span.AddEvent("resource_variable_resolution_failed", trace.WithAttributes(
			attribute.String("variable.key", key),
			attribute.String("error", err.Error()),
		))
		return nil
	}

	return result
}

// tryResolveDeploymentVariableValue attempts to resolve a variable from deployment variable values
func (m *Manager) tryResolveDeploymentVariableValue(
	ctx context.Context,
	span trace.Span,
	key string,
	deploymentVar *oapi.DeploymentVariable,
	resource *oapi.Resource,
	entity *oapi.RelatableEntity,
) *oapi.LiteralValue {
	values := m.store.DeploymentVariables.Values(deploymentVar.Id)

	// Sort values by priority (higher priority first)
	sortedValues := make([]*oapi.DeploymentVariableValue, 0, len(values))
	for _, value := range values {
		sortedValues = append(sortedValues, value)
	}
	sort.Slice(sortedValues, func(i, j int) bool {
		return sortedValues[i].Priority > sortedValues[j].Priority
	})

	// Find first matching value based on resource selector
	for _, value := range sortedValues {
		matches, err := selector.Match(ctx, value.ResourceSelector, resource)
		if err != nil {
			span.RecordError(fmt.Errorf("failed to filter matching resources: %w", err))
			return nil
		}
		if !matches {
			continue
		}

		result, err := m.store.Variables.ResolveValue(ctx, entity, &value.Value)
		if err != nil {
			span.AddEvent("deployment_variable_resolution_skipped", trace.WithAttributes(
				attribute.String("variable.key", key),
				attribute.String("error", err.Error()),
			))
			continue
		}

		return result
	}

	return nil
}
