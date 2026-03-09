package jobeligibility

import (
	"context"

	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

type Getter interface {
	ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error)
	GetDesiredRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error)
	GetJobsForReleaseTarget(ctx context.Context, rt *ReleaseTarget) ([]*oapi.Job, error)
	GetPoliciesForReleaseTarget(ctx context.Context, rt *oapi.ReleaseTarget) ([]*oapi.Policy, error)
	GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error)
	GetJobAgent(ctx context.Context, jobAgentID uuid.UUID) (*oapi.JobAgent, error)
	GetEnvironment(ctx context.Context, environmentID uuid.UUID) (*oapi.Environment, error)
	GetResource(ctx context.Context, resourceID uuid.UUID) (*oapi.Resource, error)
}
