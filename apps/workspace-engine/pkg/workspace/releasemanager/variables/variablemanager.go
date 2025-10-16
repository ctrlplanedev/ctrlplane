package variables

import (
	"context"
	"fmt"
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
	ctx, span := tracer.Start(ctx, "Evaluate", trace.WithAttributes(
		attribute.String("deployment.id", releaseTarget.DeploymentId),
		attribute.String("environment.id", releaseTarget.EnvironmentId),
		attribute.String("resource.id", releaseTarget.ResourceId),
	))
	defer span.End()

	resolvedVariables := make(map[string]*oapi.LiteralValue)

	resource, exists := m.store.Resources.Get(releaseTarget.ResourceId)
	if !exists {
		return nil, fmt.Errorf("resource %q not found", releaseTarget.ResourceId)
	}
	resourceVariables := m.store.Resources.Variables(releaseTarget.ResourceId)

	for key, rv := range resourceVariables {
		value := &rv.Value
		entity := relationships.NewResourceEntity(resource)
		result, err := m.store.Variables.ResolveValue(ctx, entity, value)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve variable %q: %w", key, err)
		}
		resolvedVariables[key] = result
	}

	deploymentVariables := m.store.Deployments.Variables(releaseTarget.DeploymentId)
	for key, deploymentVar := range deploymentVariables {
		if _, exists := resolvedVariables[key]; exists {
			// already resolved by resource variables
			continue
		}

		values := m.store.DeploymentVariables.Values(deploymentVar.Id)
		found := false

		for _, value := range values {
			ok, err := selector.FilterMatchingResources(ctx, value.ResourceSelector, resource)
			if err != nil {
				return nil, fmt.Errorf("failed to filter matching resources: %w", err)
			}
			if !ok {
				continue
			}

			entity := relationships.NewResourceEntity(resource)
			result, err := m.store.Variables.ResolveValue(ctx, entity, &value.Value)
			if err != nil {
				return nil, fmt.Errorf("failed to resolve variable %q: %w", key, err)
			}
			resolvedVariables[key] = result
			found = true
			break
		}

		// If no values found, use the default value
		if !found && deploymentVar.DefaultValue != nil {
			resolvedVariables[key] = deploymentVar.DefaultValue
		}
	}

	return resolvedVariables, nil
}
