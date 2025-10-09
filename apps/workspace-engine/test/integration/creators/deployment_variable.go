package creators

import (
	"workspace-engine/pkg/pb"

	"github.com/google/uuid"
)

// NewDeploymentVariable creates a new DeploymentVariable with default values
func NewDeploymentVariable(deploymentID string, key string) *pb.DeploymentVariable {
	return &pb.DeploymentVariable{
		Id:           uuid.New().String(),
		Key:          key,
		DeploymentId: deploymentID,
	}
}

// NewDeploymentVariableValue creates a new DeploymentVariableValue with default values
func NewDeploymentVariableValue(variableID string) *pb.DeploymentVariableValue {
	return &pb.DeploymentVariableValue{
		Id:                     uuid.New().String(),
		DeploymentVariableId:   variableID,
		Priority:               0,
	}
}

