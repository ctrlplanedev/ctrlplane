package forcedeploy

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
)

type Getter interface {
	ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error)
	GetDesiredRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error)
	GetActiveJobsForReleaseTarget(ctx context.Context, rt *oapi.ReleaseTarget) ([]*oapi.Job, error)
	GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error)
	GetEnvironment(ctx context.Context, environmentID uuid.UUID) (*oapi.Environment, error)
	GetResource(ctx context.Context, resourceID uuid.UUID) (*oapi.Resource, error)
	ListJobAgentsByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) ([]oapi.JobAgent, error)
}
