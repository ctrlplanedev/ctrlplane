package creators

import (
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

// NewDeploymentVariable creates a new DeploymentVariable with default values
func NewDeploymentVariable(deploymentID string, key string) *oapi.DeploymentVariable {
	return &oapi.DeploymentVariable{
		Id:           uuid.New().String(),
		Key:          key,
		DeploymentId: deploymentID,
		VariableId:   uuid.New().String(),
	}
}

// NewDeploymentVariableValue creates a new DeploymentVariableValue with default values
func NewDeploymentVariableValue(variableID string) *oapi.DeploymentVariableValue {
	return &oapi.DeploymentVariableValue{
		Id:                   uuid.New().String(),
		DeploymentVariableId: variableID,
		Priority:             0,
	}
}
