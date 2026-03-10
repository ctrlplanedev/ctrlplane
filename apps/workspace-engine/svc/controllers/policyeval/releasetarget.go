package policyeval

import (
	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
)

// ReleaseTarget identifies the deployment × environment × resource triple.
type ReleaseTarget struct {
	DeploymentID  uuid.UUID
	EnvironmentID uuid.UUID
	ResourceID    uuid.UUID
}

func (rt *ReleaseTarget) ToOAPI() *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		DeploymentId:  rt.DeploymentID.String(),
		EnvironmentId: rt.EnvironmentID.String(),
		ResourceId:    rt.ResourceID.String(),
	}
}
