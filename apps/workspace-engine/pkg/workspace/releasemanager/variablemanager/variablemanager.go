package variablemanager

import (
	"context"
	"fmt"
	"sort"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/workspace/store"

	"google.golang.org/protobuf/types/known/structpb"
)

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

func (m *Manager) DeploymentVariables(deploymentId string) map[string]*DeploymentVariableWithValues {
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
	evaluatedVariables := make(map[string]*pb.VariableValue)

	// Get the resource for selector matching
	resource, exists := m.store.Resources.Get(releaseTarget.ResourceId)
	if !exists {
		return nil, fmt.Errorf("resource %q not found", releaseTarget.ResourceId)
	}

	deploymentVariables := m.DeploymentVariables(releaseTarget.DeploymentId)

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
		resolvedValue, err := m.extractValueFromVariableValue(variableValue)
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
func (m *Manager) matchesResourceSelector(ctx context.Context, resource *pb.Resource, selector *structpb.Struct) (bool, error) {
	unknownCondition, err := unknown.ParseFromMap(selector.AsMap())
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
func (m *Manager) extractValueFromVariableValue(variableValue *pb.DeploymentVariableValue) (*pb.VariableValue, error) {
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
