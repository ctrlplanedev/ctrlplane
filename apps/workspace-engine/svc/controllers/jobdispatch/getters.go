package jobdispatch

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
)

type Getter interface {
	GetJob(ctx context.Context, jobID uuid.UUID) (*oapi.Job, error)
	GetRelease(ctx context.Context, releaseID uuid.UUID) (*oapi.Release, error)
	GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error)
	GetJobAgent(ctx context.Context, jobAgentID uuid.UUID) (*oapi.JobAgent, error)
	GetVerificationPolicies(
		ctx context.Context,
		rt *ReleaseTarget,
	) ([]oapi.VerificationMetricSpec, error)
	IsWorkflowJob(ctx context.Context, jobID uuid.UUID) (bool, error)
}
