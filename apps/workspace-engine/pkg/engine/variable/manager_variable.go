package variable

import (
	"context"
	"fmt"
	"workspace-engine/pkg/model/resource"
)

type VariableManager interface {
	Resolve(ctx context.Context, resource *resource.Resource, deploymentID string, key string) (*string, error)
}

type WorkspaceVariableManager struct {
	getKeys  func(ctx context.Context, deploymentID string) []string
	managers []VariableManager
}

func NewWorkspaceVariableManager(
	getKeys func(ctx context.Context, deploymentID string) []string,
	managers []VariableManager,
) *WorkspaceVariableManager {
	return &WorkspaceVariableManager{
		getKeys:  getKeys,
		managers: managers,
	}
}

func (v *WorkspaceVariableManager) ResolveDeploymentVariables(ctx context.Context, resource *resource.Resource, deploymentID string) (map[string]string, error) {
	resolvedVariables := make(map[string]string)

	keys := v.getKeys(ctx, deploymentID)
	for _, key := range keys {
		for _, manager := range v.managers {
			resolvedValue, err := manager.Resolve(ctx, resource, deploymentID, key)
			if err != nil {
				return nil, fmt.Errorf("failed to resolve for key: %s, resource: %s, err: %w", key, resource.GetID(), err)
			}

			if resolvedValue != nil {
				resolvedVariables[key] = *resolvedValue
				break
			}
		}
	}

	return resolvedVariables, nil
}
