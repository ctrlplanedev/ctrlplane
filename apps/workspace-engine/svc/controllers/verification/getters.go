package verification

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"
)

type Getter interface {
	// GetVerification returns the full verification record including all
	// metric statuses and their measurements.
	GetVerification(ctx context.Context, verificationID string) (*oapi.JobVerification, error)

	// GetJob returns the job associated with a verification.
	GetJob(ctx context.Context, jobID string) (*oapi.Job, error)

	// GetProviderContext builds the provider context needed for metric
	// measurement (release, resource, environment, version, deployment, variables).
	GetProviderContext(ctx context.Context, releaseID string) (*provider.ProviderContext, error)

	// GetReleaseTarget returns the release target IDs for the given release,
	// used to enqueue a desired-release reconcile item on verification completion.
	GetReleaseTarget(ctx context.Context, releaseID string) (*ReleaseTarget, error)
}
