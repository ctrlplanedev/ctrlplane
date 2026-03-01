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

func (s *PostgresSetter) CreateJob(_ context.Context, _ *oapi.Job) error {
	// TODO: implement — insert into job table and release_job link table
	// within a transaction.
	return nil
}
