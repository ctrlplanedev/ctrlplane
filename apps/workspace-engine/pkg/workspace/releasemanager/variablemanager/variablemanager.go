package variablemanager

import (
	"context"
	"fmt"
	"sort"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
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
	DeploymentVariable *pb.DeploymentVariable
	Values             map[string]*pb.DeploymentVariableValue
}

func (m *Manager) DeploymentVariables(ctx context.Context, deploymentId string) map[string]*DeploymentVariableWithValues {
	ctx, span := tracer.Start(ctx, "DeploymentVariables", trace.WithAttributes(
		attribute.String("deployment.id", deploymentId),
	))
	defer span.End()

	deploymentVariables := make(map[string]*DeploymentVariableWithValues)

	for key, variable := range m.store.Deployments.Variables(deploymentId) {
		values := m.store.DeploymentVariables.Values(variable.Id)
		deploymentVariables[key] = &DeploymentVariableWithValues{
			DeploymentVariable: variable,
			Values:             values,
		}
	}

	return deploymentVariables
}

func (m *Manager) Evaluate(ctx context.Context, releaseTarget *pb.ReleaseTarget) (map[string]*pb.VariableValue, error) {
	ctx, span := tracer.Start(ctx, "Evaluate", trace.WithAttributes(
		attribute.String("deployment.id", releaseTarget.DeploymentId),
		attribute.String("environment.id", releaseTarget.EnvironmentId),
		attribute.String("resource.id", releaseTarget.ResourceId),
	))
	defer span.End()

	evaluatedVariables := make(map[string]*pb.VariableValue)

	// Get the resource for selector matching
	resource, exists := m.store.Resources.Get(releaseTarget.ResourceId)
	if !exists {
		return nil, fmt.Errorf("resource %q not found", releaseTarget.ResourceId)
	}

	deploymentVariables := m.DeploymentVariables(ctx, releaseTarget.DeploymentId)

	for _, deploymentVar := range deploymentVariables {
		variableKey := deploymentVar.DeploymentVariable.Key

		resolvedValue, err := m.resolveVariableValue(ctx, resource, deploymentVar)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve variable %q: %w", variableKey, err)
		}

		// Use resolved value if found, otherwise fall back to default
		if resolvedValue != nil {
			evaluatedVariables[variableKey] = resolvedValue
		} else {
			evaluatedVariables[variableKey] = deploymentVar.DeploymentVariable.DefaultValue
		}
	}

	// TODO: resourceVariables := m.store.Resources.Variables(releaseTarget.ResourceId)

	return evaluatedVariables, nil
}

// resolveVariableValue resolves a deployment variable by iterating through its values
// ordered by priority (highest to lowest) and returning the first value that matches
// the resource selector
func (m *Manager) resolveVariableValue(ctx context.Context, resource *pb.Resource, deploymentVar *DeploymentVariableWithValues) (*pb.VariableValue, error) {
	ctx, span := tracer.Start(ctx, "resolveVariableValue", trace.WithAttributes(
		attribute.String("deployment.variable.key", deploymentVar.DeploymentVariable.Key),
		attribute.String("deployment.variable.id", deploymentVar.DeploymentVariable.Id),
		attribute.String("resource.id", resource.Id),
	))
	defer span.End()

	// Convert map to slice for sorting
	valuesList := make([]*pb.DeploymentVariableValue, 0, len(deploymentVar.Values))
	for _, value := range deploymentVar.Values {
		valuesList = append(valuesList, value)
	}

	// Sort by priority: highest to lowest
	sort.Slice(valuesList, func(i, j int) bool {
		return valuesList[i].Priority > valuesList[j].Priority
	})

	// Iterate through values in priority order
	for _, variableValue := range valuesList {
		// Check if resource selector matches
		if variableValue.ResourceSelector != nil {
			matches, err := m.matchesResourceSelector(ctx, resource, variableValue.ResourceSelector)
			if err != nil {
				return nil, fmt.Errorf("failed to evaluate resource selector: %w", err)
			}
			if !matches {
				// Skip this value and continue to the next
				continue
			}
		}

		// Extract and return the value
		resolvedValue, err := m.extractValueFromVariableValue(ctx, variableValue)
		if err != nil {
			return nil, err
		}

		if resolvedValue != nil {
			return resolvedValue, nil
		}
	}

	return nil, nil
}

// matchesResourceSelector checks if a resource matches a given selector
func (m *Manager) matchesResourceSelector(ctx context.Context, resource *pb.Resource, selector *pb.Selector) (bool, error) {
	ctx, span := tracer.Start(ctx, "matchesResourceSelector", trace.WithAttributes(
		attribute.String("resource.id", resource.Id),
		attribute.String("selector", selector.String()),
	))
	defer span.End()

	jsonSeelctor := selector.GetJson()

	unknownCondition, err := unknown.ParseFromMap(jsonSeelctor.AsMap())
	if err != nil {
		return false, fmt.Errorf("failed to parse resource selector: %w", err)
	}

	condition, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
	if err != nil {
		return false, fmt.Errorf("failed to convert resource selector: %w", err)
	}

	matches, err := condition.Matches(resource)
	if err != nil {
		return false, fmt.Errorf("failed to match resource: %w", err)
	}

	return matches, nil
}

// extractValueFromVariableValue extracts the actual value from a DeploymentVariableValue
// based on its type (direct, reference, or sensitive)
func (m *Manager) extractValueFromVariableValue(ctx context.Context, variableValue *pb.DeploymentVariableValue) (*pb.VariableValue, error) {
	ctx, span := tracer.Start(ctx, "extractValueFromVariableValue", trace.WithAttributes(
		attribute.String("deployment.variable.id", variableValue.DeploymentVariableId),
		attribute.String("deployment.variable.value.id", variableValue.Id),
	))
	defer span.End()

	switch valueType := variableValue.Value.(type) {
	case *pb.DeploymentVariableValue_DirectValue:
		return valueType.DirectValue, nil

	case *pb.DeploymentVariableValue_ReferenceValue:
		return nil, fmt.Errorf("resource reference variable currently not supported")

	case *pb.DeploymentVariableValue_SensitiveValue:
		return nil, fmt.Errorf("sensitive variable currently not supported")

	default:
		return nil, fmt.Errorf("unknown variable value type")
	}
}
