package verification

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"
)

var _ Getter = &PostgresGetter{}

type PostgresGetter struct{}

// GetVerification implements [Getter].
func (p *PostgresGetter) GetVerification(ctx context.Context, verificationID string) (*oapi.JobVerification, error) {
	panic("unimplemented")
}

// GetJob implements [Getter].
func (p *PostgresGetter) GetJob(ctx context.Context, jobID string) (*oapi.Job, error) {
	panic("unimplemented")
}

// GetProviderContext implements [Getter].
func (p *PostgresGetter) GetProviderContext(ctx context.Context, releaseID string) (*provider.ProviderContext, error) {
	panic("unimplemented")
}

// GetReleaseTarget implements [Getter].
func (p *PostgresGetter) GetReleaseTarget(ctx context.Context, releaseID string) (*ReleaseTarget, error) {
	panic("unimplemented")
}
