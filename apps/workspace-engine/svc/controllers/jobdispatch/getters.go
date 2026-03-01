package jobdispatch

import (
	"context"

	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

type Getter interface {
	ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error)

	// GetDesiredRelease returns the current desired release for the target,
	// or nil if no desired release has been computed yet.
	GetDesiredRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error)

	// GetJobsForRelease returns all jobs linked to the given release ID,
	// ordered by creation time descending.
	GetJobsForRelease(ctx context.Context, releaseID uuid.UUID) ([]oapi.Job, error)

	// GetActiveJobsForTarget returns jobs in a processing state
	// (pending, inProgress, actionRequired) for the release target.
	GetActiveJobsForTarget(ctx context.Context, rt *ReleaseTarget) ([]oapi.Job, error)

	// GetJobAgentsForDeployment returns the job agents configured for the
	// deployment, including merged config from agent + deployment layers.
	GetJobAgentsForDeployment(ctx context.Context, deploymentID uuid.UUID) ([]oapi.JobAgent, error)

	// GetVerificationPolicies returns the verification metric specs from
	// policy_rule_verification rows that match the given release target.
	GetVerificationPolicies(ctx context.Context, rt *ReleaseTarget) ([]oapi.VerificationMetricSpec, error)
}
