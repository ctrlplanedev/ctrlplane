package creators

import (
	"fmt"
	"workspace-engine/pkg/pb"

	"github.com/google/uuid"
)

// NewDeploymentVersion creates a test DeploymentVersion with sensible defaults
// All fields can be overridden via functional options
func NewDeployment() *pb.Deployment {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id[:8]

	dv := &pb.Deployment{
		Id:               id,
		Name:             fmt.Sprintf("d-%s", idSubstring),
		Slug:             fmt.Sprintf("d-%s", idSubstring),
		Description:      fmt.Sprintf("d-%s", idSubstring),
		SystemId:         uuid.New().String(),
		JobAgentId:       nil,
		JobAgentConfig:   nil,
		ResourceSelector: nil,
	}

	return dv
}
