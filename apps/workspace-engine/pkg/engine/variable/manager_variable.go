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
	deploymentVariables *DeploymentVariableRepository
	managers            []VariableManager
}

func NewWorkspaceVariableManager(
	deploymentVariables *DeploymentVariableRepository,
	managers []VariableManager,
) *WorkspaceVariableManager {
	return &WorkspaceVariableManager{
		deploymentVariables: deploymentVariables,
		managers:            managers,
	}
}

func (v *WorkspaceVariableManager) getKeys(ctx context.Context, deploymentID string) []string {
	deploymentVariables := v.deploymentVariables.GetAllByDeploymentID(ctx, deploymentID)
	keys := make([]string, 0)
	for _, variablePtr := range deploymentVariables {
		if variablePtr == nil || *variablePtr == nil {
			continue
		}

		keys = append(keys, (*variablePtr).GetKey())
	}

	return keys
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
