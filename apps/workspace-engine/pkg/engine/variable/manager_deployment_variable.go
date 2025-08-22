package variable

import (
	"context"
	"fmt"
	"workspace-engine/pkg/model/resource"
)

var _ VariableManager = (*DeploymentVariableManager)(nil)

type DeploymentVariableManager struct {
	deploymentVariables *DeploymentVariableRepository
}

func NewDeploymentVariableManager(deploymentVariables *DeploymentVariableRepository) *DeploymentVariableManager {
	return &DeploymentVariableManager{
		deploymentVariables: deploymentVariables,
	}
}

func (m *DeploymentVariableManager) Resolve(ctx context.Context, resource *resource.Resource, deploymentID string, key string) (*string, error) {
	deploymentVariablePtr := m.deploymentVariables.GetByDeploymentIDAndKey(ctx, deploymentID, key)
	if deploymentVariablePtr == nil || *deploymentVariablePtr == nil {
		return nil, nil
	}

	deploymentVariable := *deploymentVariablePtr

	resolved, err := deploymentVariable.Resolve(ctx, resource)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve deployment variable for key: %s, deploymentID: %s, err: %w", key, deploymentID, err)
	}

	return &resolved, nil
}
