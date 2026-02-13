package creators

import (
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

var deploymentVersionCounter = 0

// NewDeploymentVersion creates a test DeploymentVersion with sensible defaults
// All fields can be overridden via functional options
func NewDeploymentVersion() *oapi.DeploymentVersion {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id
	if len(id) > 8 {
		idSubstring = id[:8]
	}

	deploymentVersionCounter++
	dv := &oapi.DeploymentVersion{
		Id:             id,
		Name:           fmt.Sprintf("dv-%s", idSubstring),
		Tag:            fmt.Sprintf("v1.0.%d", deploymentVersionCounter),
		DeploymentId:   uuid.New().String(),
		Status:         oapi.DeploymentVersionStatusReady,
		CreatedAt:      time.Now(),
		Config:         make(map[string]any),
		JobAgentConfig: make(map[string]any),
		Metadata:       make(map[string]string),
	}

	return dv
}
