package jobdispatch

import (
	"context"

	"workspace-engine/pkg/oapi"
)

var _ Setter = &PostgresSetter{}

type PostgresSetter struct{}

// UpdateJob implements [testrunner.Setter].
func (s *PostgresSetter) UpdateJob(ctx context.Context, jobID string, status oapi.JobStatus, message string) error {
	panic("unimplemented")
}

// CreateJobWithVerification implements [Setter].
func (s *PostgresSetter) CreateJobWithVerification(_ context.Context, _ *oapi.Job, _ []oapi.VerificationMetricSpec) error {
	// TODO: implement — in a single transaction:
	//   1. Insert job row + release_job link
	//   2. If specs is non-empty, create a JobVerification record with metric
	//      statuses initialised from the specs
	//   3. Enqueue one "verification" queue item per metric
	return nil
}
