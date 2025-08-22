package variable

import (
	"context"
	"fmt"
	"workspace-engine/pkg/model/resource"
)

var _ VariableManager = (*ResourceVariableManager)(nil)

type ResourceVariableManager struct {
	resourceVariables *ResourceVariableRepository
}

func NewResourceVariableManager(resourceVariables *ResourceVariableRepository) *ResourceVariableManager {
	return &ResourceVariableManager{
		resourceVariables: resourceVariables,
	}
}

func (m *ResourceVariableManager) Resolve(ctx context.Context, resource *resource.Resource, deploymentID string, key string) (*string, error) {
	resourceVariablePtr := m.resourceVariables.GetByResourceIDAndKey(ctx, resource.GetID(), key)
	if resourceVariablePtr == nil || *resourceVariablePtr == nil {
		return nil, nil
	}

	resourceVariable := *resourceVariablePtr

	resolved, err := resourceVariable.Resolve(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve resource variable for key: %s, resource: %s, err: %w", key, resource.GetID(), err)
	}

	return &resolved, nil
}
