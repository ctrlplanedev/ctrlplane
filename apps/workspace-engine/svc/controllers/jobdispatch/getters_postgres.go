package jobdispatch

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/jobdispatch/jobagents"

	"github.com/google/uuid"
)

var _ Getter = &PostgresGetter{}
var _ jobagents.Getter = &PostgresGetter{}

type PostgresGetter struct{}

// GetEnvironment implements [jobagents.Getter].
func (p *PostgresGetter) GetEnvironment(id string) (*oapi.Environment, bool) {
	panic("unimplemented")
}

// GetJobAgent implements [jobagents.Getter].
func (p *PostgresGetter) GetJobAgent(id string) (*oapi.JobAgent, bool) {
	panic("unimplemented")
}

// GetResource implements [jobagents.Getter].
func (p *PostgresGetter) GetResource(id string) (*oapi.Resource, bool) {
	panic("unimplemented")
}

// GetActiveJobsForTarget implements [Getter].
func (p *PostgresGetter) GetActiveJobsForTarget(ctx context.Context, rt *ReleaseTarget) ([]oapi.Job, error) {
	panic("unimplemented")
}

// GetDesiredRelease implements [Getter].
func (p *PostgresGetter) GetDesiredRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error) {
	panic("unimplemented")
}

// GetJobAgentsForDeployment implements [Getter].
func (p *PostgresGetter) GetJobAgentsForDeployment(ctx context.Context, deploymentID uuid.UUID) ([]oapi.JobAgent, error) {
	panic("unimplemented")
}

// GetJobsForRelease implements [Getter].
func (p *PostgresGetter) GetJobsForRelease(ctx context.Context, releaseID uuid.UUID) ([]oapi.Job, error) {
	panic("unimplemented")
}

// ReleaseTargetExists implements [Getter].
func (p *PostgresGetter) ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error) {
	panic("unimplemented")
}
