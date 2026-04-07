package jobeligibility

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/releasetargetconcurrency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/retry"
)

type concurrencyGetter = releasetargetconcurrency.Getters
type retryGetter = retry.Getters

type Getter interface {
	concurrencyGetter
	retryGetter

	ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error)
	GetDesiredRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error)
	GetPoliciesForReleaseTarget(ctx context.Context, rt *oapi.ReleaseTarget) ([]*oapi.Policy, error)
	GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error)
	GetJobAgent(ctx context.Context, jobAgentID uuid.UUID) (*oapi.JobAgent, error)
	ListJobAgentsByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) ([]oapi.JobAgent, error)
	GetEnvironment(ctx context.Context, environmentID uuid.UUID) (*oapi.Environment, error)
	GetResource(ctx context.Context, resourceID uuid.UUID) (*oapi.Resource, error)
}
