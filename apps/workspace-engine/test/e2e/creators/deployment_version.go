package creators

import (
	"fmt"
	"time"
	"workspace-engine/pkg/pb"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/structpb"
)

var deploymentVersionCounter = 0

// NewDeploymentVersion creates a test DeploymentVersion with sensible defaults
// All fields can be overridden via functional options
func NewDeploymentVersion(opts ...Option) *pb.DeploymentVersion {
	// Create with defaults
	id := uuid.New().String()
	idSubstring := id
	if len(id) > 8 {
		idSubstring = id[:8]
	}

	deploymentVersionCounter++
	dv := &pb.DeploymentVersion{
		Id:             id,
		Name:           fmt.Sprintf("dv-%s", idSubstring),
		Tag:            fmt.Sprintf("v1.0.%d", deploymentVersionCounter),
		DeploymentId:   uuid.New().String(),
		Status:         pb.DeploymentVersionStatus_DEPLOYMENT_VERSION_STATUS_READY,
		CreatedAt:      time.Now().Format(time.RFC3339),
		Config:         MustNewStructFromMap(map[string]any{}),
		JobAgentConfig: MustNewStructFromMap(map[string]any{}),
	}

	// Apply options to override defaults
	for _, opt := range opts {
		opt(dv)
	}

	return dv
}

// Helper function to create a structpb.Struct from a map
func MustNewStructFromMap(m map[string]any) *structpb.Struct {
	s, err := structpb.NewStruct(m)
	if err != nil {
		panic(fmt.Sprintf("failed to create struct: %v", err))
	}
	return s
}
